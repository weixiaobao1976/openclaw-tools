#!/bin/bash
# 启动前网络就绪检查（ExecStartPre 使用）
for i in $(seq 1 30); do
    if ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
        if nslookup google.com 2>/dev/null | grep -q "Name"; then
            echo "[check-network] Network ready after ${i}s"; exit 0
        fi
    fi
    sleep 1
done
echo "[check-network] WARNING: Network timeout, continuing"; exit 0
