#!/bin/bash
# Model Health Check & Auto-Routing Script
# Runs daily at midnight to verify all role models and auto-switch to working backup

LOG_FILE="$HOME/.openclaw/logs/model-health.log"
CONFIG_FILE="$HOME/.openclaw/openclaw.json"
CONFIG_BACKUP="$HOME/.openclaw/openclaw.json.auto-backup"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========== Model Health Check Started =========="

# Read API credentials from config
NVIDIA_API_KEY=$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c['models']['providers']['nvidia'].get('apiKey',''))")
NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1"
SENSENOVA_API_KEY=$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c['models']['providers']['sensenova'].get('apiKey',''))")
SENSENOVA_BASE_URL="https://token.sensenova.cn/v1"

# Test a single model
test_model() {
    local model_id=$1
    local provider=$2

    local api_key="$NVIDIA_API_KEY"
    local base_url="$NVIDIA_BASE_URL"
    [ "$provider" = "sensenova" ] && { api_key="$SENSENOVA_API_KEY"; base_url="$SENSENOVA_BASE_URL"; }

    # Remove provider prefix for API call
    local api_model_id=$(echo "$model_id" | sed 's/^[a-z]*\///')

    local result=$(curl -s --max-time 30 \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -X POST "$base_url/chat/completions" \
        -d "{\"model\":\"$api_model_id\",\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}],\"max_tokens\":5}" 2>&1)

    if echo "$result" | grep -q "choices"; then
        echo "OK"
    else
        echo "FAIL"
    fi
}

# Model categories: category:provider:model_id
# Primary models first, then backups
MODELS=(
    "default:nvidia:z-ai/glm4.7"
    "default:nvidia:minimaxai/minimax-m2.5"
    "default:sensenova:deepseek-v4-flash"

    "coding:nvidia:qwen/qwen2.5-coder-32b-instruct"
    "coding:nvidia:deepseek-ai/deepseek-coder-6.7b-instruct"
    "coding:nvidia:bigcode/starcoder2-15b"

    "vision:nvidia:meta/llama-3.2-11b-vision-instruct"
    "vision:nvidia:meta/llama-3.2-90b-vision-instruct"
    "vision:nvidia:microsoft/phi-3-vision-128k-instruct"

    "reasoning:nvidia:qwen/qwen3-next-80b-a3b-thinking"
    "reasoning:nvidia:moonshotai/kimi-k2-thinking"
    "reasoning:nvidia:cosmos-reason2-8b"
)

declare -A WORKING_MODELS

# Test all models
for model_entry in "${MODELS[@]}"; do
    IFS=':' read -r category provider model_id <<< "$model_entry"

    log "Testing [$category] $provider/$model_id..."

    result=$(test_model "$model_id" "$provider")

    if [ "$result" = "OK" ]; then
        log "  ✓ $provider/$model_id - OK"
        if [ -z "${WORKING_MODELS[$category]}" ]; then
            WORKING_MODELS[$category]="$provider/$model_id"
            log "  → Primary for [$category]: $provider/$model_id"
        else
            log "  → Backup for [$category]: $provider/$model_id"
        fi
    else
        log "  ✗ $provider/$model_id - FAIL"
    fi
done

# Summary
log ""
log "========== Health Check Summary =========="

for category in default coding vision reasoning; do
    if [ -n "${WORKING_MODELS[$category]}" ]; then
        log "[$category] ✓ Primary: ${WORKING_MODELS[$category]}"
    else
        log "[$category] ✗ All models failed!"
    fi
done

# Auto-update config
log ""
log "========== Auto-Routing Update =========="

cp "$CONFIG_FILE" "$CONFIG_BACKUP"
log "Backed up config to $CONFIG_BACKUP"

# Python update script
python3 << PYEOF
import json

CONFIG_FILE = '$CONFIG_FILE'

with open(CONFIG_FILE, 'r') as f:
    config = json.load(f)

if 'agents' not in config:
    config['agents'] = {}
if 'defaults' not in config['agents']:
    config['agents']['defaults'] = {}

# Current working models from bash (set via environment would be complex, re-test here)
import subprocess

def test_model(model_id, provider):
    api_keys = {'nvidia': '$NVIDIA_API_KEY', 'sensenova': '$SENSENOVA_API_KEY'}
    base_urls = {'nvidia': '$NVIDIA_BASE_URL', 'sensenova': '$SENSENOVA_BASE_URL'}
    api_key = api_keys.get(provider, '')
    base_url = base_urls.get(provider, '')
    api_model_id = model_id.split('/')[-1]
    
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '25',
             '-H', f'Authorization: Bearer {api_key}',
             '-H', 'Content-Type: application/json',
             '-X', 'POST', f'{base_url}/chat/completions',
             '-d', json.dumps({"model": api_model_id, "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 5})],
            capture_output=True, text=True, timeout=30
        )
        return 'choices' in result.stdout
    except:
        return False

# Model lists
models = {
    'default': [('z-ai/glm4.7', 'nvidia'), ('minimaxai/minimax-m2.5', 'nvidia'), ('deepseek-v4-flash', 'sensenova')],
    'coding': [('qwen/qwen2.5-coder-32b-instruct', 'nvidia'), ('deepseek-ai/deepseek-coder-6.7b-instruct', 'nvidia'), ('bigcode/starcoder2-15b', 'nvidia')],
    'vision': [('meta/llama-3.2-11b-vision-instruct', 'nvidia'), ('meta/llama-3.2-90b-vision-instruct', 'nvidia'), ('microsoft/phi-3-vision-128k-instruct', 'nvidia')],
    'reasoning': [('qwen/qwen3-next-80b-a3b-thinking', 'nvidia'), ('moonshotai/kimi-k2-thinking', 'nvidia'), ('cosmos-reason2-8b', 'nvidia')],
}

changes = []

# Update default model
for model_id, provider in models['default']:
    full_id = f'nvidia/{model_id}' if provider == 'nvidia' else f'sensenova/{model_id}'
    if test_model(model_id, provider):
        fallbacks = [f'nvidia/{m}' for m, p in models['default'] if m != model_id]
        config['agents']['defaults']['model'] = {'primary': full_id, 'fallbacks': fallbacks}
        changes.append(f"default: {full_id}")
        break

# Update imageModel (uses vision models)
for model_id, provider in models['vision']:
    full_id = f'nvidia/{model_id}' if provider == 'nvidia' else f'sensenova/{model_id}'
    if test_model(model_id, provider):
        config['agents']['defaults']['imageModel'] = {'primary': full_id}
        changes.append(f"imageModel: {full_id}")
        break

# Update other categories
for cat in ['coding', 'vision', 'reasoning']:
    for model_id, provider in models[cat]:
        full_id = f'nvidia/{model_id}' if provider == 'nvidia' else f'sensenova/{model_id}'
        if test_model(model_id, provider):
            fallbacks = [f'nvidia/{m}' for m, p in models[cat] if m != model_id]
            config['agents']['defaults'][f'{cat}_model'] = {'primary': full_id, 'fallbacks': fallbacks}
            changes.append(f"{cat}: {full_id}")
            break

with open(CONFIG_FILE, 'w') as f:
    json.dump(config, f, indent=2)

for change in changes:
    print(f"  Updated {change}")

if not changes:
    print("  No changes needed (all primary models healthy)")
PYEOF

log ""
log "========== Health Check Completed =========="
log ""