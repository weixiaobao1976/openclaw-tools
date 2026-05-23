#!/bin/bash
# 磁盘空间监控 — 每30分钟
USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$USAGE" -gt 90 ]; then
    logger -t "monitor-disk" "CRITICAL: Disk usage $USAGE%"
elif [ "$USAGE" -gt 80 ]; then
    logger -t "monitor-disk" "WARNING: Disk usage $USAGE%"
fi
