#!/bin/bash
# 从备份恢复配置
BACKUP="$1"
[ -z "$BACKUP" ] && echo "用法: $0 <备份目录路径>" && exit 1
[ ! -d "$BACKUP" ] && echo "备份目录不存在: $BACKUP" && exit 1
echo "从 $BACKUP 恢复..."
[ -f "$BACKUP/openclaw.json" ] && cp "$BACKUP/openclaw.json" "$HOME/.openclaw/" && echo "✅ openclaw.json"
[ -f "$BACKUP/crontab.txt" ] && crontab "$BACKUP/crontab.txt" && echo "✅ crontab"
[ -d "$BACKUP/credentials" ] && cp "$BACKUP/credentials/"*.json "$HOME/.openclaw/credentials/" && echo "✅ credentials"
[ -d "$BACKUP/workspace" ] && cp "$BACKUP/workspace/"* "$HOME/.openclaw/workspace/" 2>/dev/null && echo "✅ workspace"
echo "恢复完成，重启 gateway: systemctl --user restart openclaw-gateway.service"
