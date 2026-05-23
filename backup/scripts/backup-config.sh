#!/bin/bash
# OpenClaw 分层配置备份
# L0: auto(按需)  L1: manual(重大变更前)  L2: full(系统更新)
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$HOME/.openclaw/backup/config-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"/{credentials,workspace}
# 核心配置
cp "$HOME/.openclaw/openclaw.json" "$BACKUP_DIR/" 2>/dev/null
cp "$HOME/.openclaw/gateway-owner.json" "$BACKUP_DIR/" 2>/dev/null
cp "$HOME/.openclaw/exec-approvals.json" "$BACKUP_DIR/" 2>/dev/null
# 凭证
cp "$HOME/.openclaw/credentials/"*.json "$BACKUP_DIR/credentials/" 2>/dev/null
# workspace 关键文件
for f in SOUL.md USER.md AGENTS.md IDENTITY.md TOOLS.md HEARTBEAT.md MEMORY.md; do
  [ -f "$HOME/.openclaw/workspace/$f" ] && cp "$HOME/.openclaw/workspace/$f" "$BACKUP_DIR/workspace/"
done
# cron/flows/tasks
cp -a "$HOME/.openclaw/cron" "$BACKUP_DIR/" 2>/dev/null
cp -a "$HOME/.openclaw/flows" "$BACKUP_DIR/" 2>/dev/null
cp -a "$HOME/.openclaw/tasks" "$BACKUP_DIR/" 2>/dev/null
# crontab
crontab -l > "$BACKUP_DIR/crontab.txt" 2>/dev/null
echo "✅ 备份完成: $BACKUP_DIR ($(du -sh "$BACKUP_DIR" | cut -f1))"
