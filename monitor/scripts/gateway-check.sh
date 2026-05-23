#!/bin/bash
# Gateway 进程守护 — 每5分钟（crontab）
# 用端口精确查 PID，避免 pgrep 自匹配
PORT=18789
LOCKFILE=/tmp/gateway-check.lock
exec 9>"$LOCKFILE"; flock -n 9 || exit 0
GATEWAY_PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -z "$GATEWAY_PID" ]; then
    logger -t "monitor-gateway" "Gateway not running (port $PORT), restarting..."
    systemctl --user start openclaw-gateway 2>&1 | logger -t "monitor-gateway"
elif ! curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://127.0.0.1:$PORT/ | grep -q 200; then
    logger -t "monitor-gateway" "Gateway hung, restarting..."
    kill "$GATEWAY_PID" 2>/dev/null; sleep 3
    systemctl --user start openclaw-gateway 2>&1 | logger -t "monitor-gateway"
fi
exec 9>&-
