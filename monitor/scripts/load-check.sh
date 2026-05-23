#!/bin/bash
# 系统负载监控 — 每15分钟
LOAD=$(uptime | grep -oP 'load average: \K[0-9.]+' | cut -d, -f1)
CORES=$(nproc)
if [ "$(echo "$LOAD > $CORES * 0.8" | bc)" -eq 1 ]; then
    logger -t "monitor-load" "WARNING: Load $LOAD / $CORES cores"
fi
