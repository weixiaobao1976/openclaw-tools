#!/bin/bash
# 模型状态快速查看
echo "=== 角色模型 ==="
grep 'alias' "$HOME/.openclaw/openclaw.json" | head -20 | sed 's/.*"alias": "\(.*\)"/  \1/'
echo ""
echo "=== 当前默认模型 ==="
grep -A2 '"defaultModel"' "$HOME/.openclaw/openclaw.json" | head -5
