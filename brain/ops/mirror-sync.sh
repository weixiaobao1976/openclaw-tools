#!/usr/bin/env bash
# ============================================================================
# mirror-sync.sh — GitHub 镜像同步
# 用法: bash mirror-sync.sh [auto]
#   auto: 后台运行，日志记录
# ============================================================================
set -euo pipefail

GH_USER="weixiaobao1976"
BRANCH="brain-backup"
WORKSPACE="$HOME/.openclaw/workspace"
LOG="$HOME/.openclaw/logs/mirror-sync.log"
mkdir -p "$(dirname "$LOG")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 同步开始" | tee -a "$LOG"

# 如果提供 auto 参数，后台运行
if [ "${1:-}" = "auto" ]; then
    nohup bash "$0" > "$LOG" 2>&1 &
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 后台同步已启动 (PID $!)" 
    exit 0
fi

node $HOME/.openclaw/scripts/backup-brain.mjs before 2>&1 | tee -a "$LOG"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 同步完成" | tee -a "$LOG"
