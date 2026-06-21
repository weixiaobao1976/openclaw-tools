#!/bin/bash
# 系统级监控：Gateway 进程守护 + 自动重启
# 每 5 分钟跑一次 (crontab)
# 用端口精确查 PID，避免 pgrep 匹配到自己

LOCKFILE=/tmp/gateway-check.lock
PORT=18789

# 防并发锁（crontab 可能重叠）
exec 9>"$LOCKFILE"
flock -n 9 || exit 0

# 通过端口查精确 PID
GATEWAY_PID=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)

if [ -z "$GATEWAY_PID" ]; then
    logger -t "monitor-gateway" "Gateway not running (port $PORT), attempting restart..."
    systemctl --user start openclaw-gateway 2>&1 | logger -t "monitor-gateway"
    echo "$(date '+%Y-%m-%d %H:%M:%S') Gateway was DOWN, restarted" >> /tmp/gateway-restart.log
else
    # Check if responding via HTTP
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 http://127.0.0.1:$PORT/ 2>/dev/null)
    if [ "$HTTP_CODE" != "200" ]; then
        logger -t "monitor-gateway" "Gateway running (pid=$GATEWAY_PID) but HTTP=$HTTP_CODE, restarting..."
        kill "$GATEWAY_PID" 2>/dev/null
        sleep 3
        systemctl --user start openclaw-gateway 2>&1 | logger -t "monitor-gateway"
        echo "$(date '+%Y-%m-%d %H:%M:%S') Gateway hung (HTTP=$HTTP_CODE), restarted" >> /tmp/gateway-restart.log
    fi
fi

# 每天凌晨更新一次健康日志
HOUR=$(date +%H)
MIN=$(date +%M)
if [ "$HOUR" -eq 0 ] && [ "$MIN" -lt 10 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Gateway healthy, PID=$GATEWAY_PID, port=$PORT" >> /tmp/gateway-check.log
fi

exec 9>&-