#!/usr/bin/env bash
# ============================================================================
# openclaw-config-health-check.sh
# 在改 openclaw.json 之前跑一下，提前 catch 类型错误和常见问题
# ============================================================================
# 用法:
#   ./config/openclaw-config-health-check.sh                # 检查当前配置
#   ./config/openclaw-config-health-check.sh <config.json>  # 检查指定文件
#   ./config/openclaw-config-health-check.sh --fix          # 尝试自动修复
# ============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONFIG_FILE="${1:-$HOME/.openclaw/openclaw.json}"
AUTO_FIX="${AUTO_FIX:-false}"
[[ "$*" == *--fix* ]] && AUTO_FIX=true

ERRORS=0
WARNINGS=0
FIXES=0

check_name() {
    local field="$1"
    local desc="$2"
    local expected_type="$3"

    local actual_type
    actual_type=$(jq -r "$field | type // \"null\"" "$CONFIG_FILE" 2>/dev/null || echo "missing")

    if [[ "$actual_type" == "missing" ]] || [[ "$actual_type" == "null" ]]; then
        echo -e "${YELLOW}⚠️  WARN: $field ($desc) — 不存在或未设置${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi

    if [[ "$actual_type" != "$expected_type" ]]; then
        echo -e "${RED}❌ ERROR: $field — 期望类型 $expected_type，实际类型 $actual_type${NC}"
        echo -e "   描述: $desc"
        ERRORS=$((ERRORS + 1))

        if [[ "$AUTO_FIX" == "true" ]] && [[ "$expected_type" == "array" ]] && [[ "$actual_type" == "object" ]]; then
            echo -e "${GREEN}   ↪ 自动修复中...${NC}"
            local tmpfile
            tmpfile=$(mktemp)
            jq "$field = [ $field[] ]" "$CONFIG_FILE" > "$tmpfile" 2>/dev/null && mv "$tmpfile" "$CONFIG_FILE" && {
                echo -e "${GREEN}   ✅ 修复完成${NC}"
                FIXES=$((FIXES + 1))
            } || {
                echo -e "${RED}   ❌ 自动修复失败（对象不是合法值）${NC}"
                rm -f "$tmpfile"
            }
        fi
        return 1
    fi

    echo -e "${GREEN}✅  $field — $actual_type ✓${NC}"
    return 0
}

check_value() {
    local field="$1"
    local desc="$2"
    local jq_expr="$3"

    local value
    value=$(jq -r "$field // \"__MISSING__\"" "$CONFIG_FILE" 2>/dev/null || echo "__MISSING__")

    if [[ "$value" == "__MISSING__" ]] || [[ "$value" == "null" ]]; then
        echo -e "${YELLOW}⚠️  WARN: $field ($desc) — 不存在${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi

    # 用 jq 对配置文件本身做校验（安全，无 shell eval）
    if jq -e "$jq_expr" "$CONFIG_FILE" &>/dev/null; then
        echo -e "${GREEN}✅  $field — $value ✓${NC}"
        return 0
    else
        echo -e "${RED}❌ ERROR: $field — 值不合法: $value${NC}"
        echo -e "   描述: $desc"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo "========================================"
echo " OpenClaw 配置健康检查"
echo " 文件: $CONFIG_FILE"
echo " 自动修复: ${AUTO_FIX}"
echo "========================================"
echo ""

# 0. 文件存在性
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}❌ FATAL: 文件不存在: $CONFIG_FILE${NC}"
    exit 1
fi

# 0.5 是否是合法 JSON
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${RED}❌ FATAL: 文件不是合法 JSON${NC}"
    exit 1
fi
echo -e "${GREEN}✅  文件存在且是合法 JSON ✓${NC}"

# 1. agents 必须是 object
check_name '.agents' 'Agent 配置根对象' 'object'

# 2. agents.defaults 必须是 object
check_name '.agents.defaults' 'Agent 默认配置' 'object'

# 3. agents.list 必须是 array（常见踩坑点！）
# 单 Agent 模式可能没有 agents.list，所以是可选
if jq -e '.agents | has("list")' "$CONFIG_FILE" &>/dev/null; then
    check_name '.agents.list' 'Agent 列表' 'array'
else
    echo -e "${GREEN}✅  .agents.list — 未设置（单 Agent 模式，正常）${NC}"
fi

# 4. bindings 必须是 array
check_name '.bindings' '绑定配置' 'array'

# 5. channels 必须是 object
check_name '.channels' '频道配置' 'object'

# 6. gateway 必须是 object
check_name '.gateway' 'Gateway 配置' 'object'

# 7. models 必须是 object
check_name '.models' '模型配置' 'object'

# 8. gateway.port 必须是 number
check_name '.gateway.port' 'Gateway 端口' 'number'

# 9. skills 必须是 object
check_name '.skills' '技能配置' 'object'

# 10. session 必须是 object
check_name '.session' '会话配置' 'object'

# 11. plugins 必须是 object
check_name '.plugins' '插件配置' 'object'

# 12. hooks 必须是 object
check_name '.hooks' '钩子配置' 'object'

# 13. tools 必须是 object
check_name '.tools' '工具配置' 'object'

# 14. mcp 必须是 object
check_name '.mcp' 'MCP 配置' 'object'

# 15. gateway.port 范围检查
if jq -e '.gateway.port' "$CONFIG_FILE" &>/dev/null; then
    check_value '.gateway.port' 'Gateway 端口' '.gateway.port | (. >= 1024 and . <= 65535)'
fi

# 16. agent 名称重复检查
if jq -e '.agents.list | type == "array"' "$CONFIG_FILE" &>/dev/null; then
    dup_names=$(jq -r '[.agents.list[].name] | group_by(.)[] | select(length > 1) | .[0]' "$CONFIG_FILE" 2>/dev/null || true)
    if [[ -n "$dup_names" ]]; then
        echo -e "${RED}❌ ERROR: agents.list 存在重复名称: $dup_names${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅  agents.list — 名称无重复 ✓${NC}"
    fi
fi

# 17. 显示当前使用的 agents
echo ""
echo "--- 当前 Agent 列表 ---"
if jq -e '.agents.list | type == "array"' "$CONFIG_FILE" &>/dev/null; then
    jq -r '.agents.list[] | "  - \(.name) (workspace: \(.workspace // "default"))"' "$CONFIG_FILE" 2>/dev/null || echo "  (agents.list 为空)"
else
    echo "  (无 agents.list，仅使用 defaults)"
fi

echo ""
echo "========================================"
echo -e " 结果: ${GREEN}${ERRORS} 错误${NC}, ${YELLOW}${WARNINGS} 警告${NC}, ${FIXES} 已修复"
echo "========================================"

if [[ "$ERRORS" -gt 0 ]]; then
    echo -e "${RED}❌ 配置存在问题，建议修复后再运行 Gateway${NC}"
    exit 1
elif [[ "$WARNINGS" -gt 0 ]]; then
    echo -e "${YELLOW}⚠️  配置基本健康，但有 ${WARNINGS} 个警告（可选修复）${NC}"
    exit 0
else
    echo -e "${GREEN}✅ 配置完全健康！${NC}"
    exit 0
fi