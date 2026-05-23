#!/bin/bash
# 网络连通性监控 — 每15分钟
for HOST in "8.8.8.8" "api.telegram.org" "api.github.com"; do
    if ! ping -c 1 -W 3 "$HOST" >/dev/null 2>&1; then
        logger -t "monitor-network" "WARNING: $HOST unreachable"
    fi
done
