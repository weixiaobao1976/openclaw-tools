#!/bin/bash
# 旧备份清理（保留最近N个）
KEEP=${1:-2}
echo "保留最近 $KEEP 个 backup 目录..."
TOTAL=$(ls -1dt "$HOME/.openclaw/backup/config-"*/ 2>/dev/null | wc -l)
if [ "$TOTAL" -gt "$KEEP" ]; then
  ls -1dt "$HOME/.openclaw/backup/config-"*/ 2>/dev/null | tail -$((TOTAL - KEEP)) | xargs rm -rf
  echo "已清理 $((TOTAL - KEEP)) 个旧备份"
else
  echo "无需清理 ($TOTAL 个)"
fi
# 清理 openclaw.json 旧备份（保留3个manual + last-good + auto-backup）
for prefix in "manual-backup" "bak"; do
  files=($HOME/.openclaw/openclaw.json."$prefix"*)
  count=${#files[@]}
  if [ "$count" -gt 3 ] && [ -f "${files[0]}" ]; then
    for f in "${files[@]:3}"; do rm -f "$f"; done
    echo "清理 $prefix 旧备份 $((count - 3)) 个"
  fi
done
