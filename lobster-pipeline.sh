#!/bin/bash
# lobster-pipeline.sh — JSON-typed运维管道（参考 lobster 模式）
# 原理: 每个步骤输出JSON → 下一个步骤作为输入
# 用途: 代替传统shell管道（重试/审批/可恢复）

set -euo pipefail

PIPELINE_LOG="/tmp/openclaw/pipeline-$(date +%s).jsonl"
mkdir -p /tmp/openclaw

log_step() {
  local step=$1 status=$2 data=$3
  echo "{\"step\":\"$step\",\"status\":\"$status\",\"ts\":\"$(date -Iseconds)\",\"data\":$data}" >> "$PIPELINE_LOG"
  echo "[$step] $status"
}

check_gateway() {
  local pid
  pid=$(ss -tlnp "sport = :18789" 2>/dev/null | grep -Po '(?<=pid=)\d+' | head -1)
  if [ -n "$pid" ]; then
    local mem cpu up
    mem=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
    up=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
    log_step "gateway" "ok" "{\"pid\":$pid,\"memMB\":$mem,\"uptime\":\"$up\"}"
    return 0
  else
    log_step "gateway" "down" "{}"
    return 1
  fi
}

check_disk() {
  local usage
  usage=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
  local free_gb
  free_gb=$(df -h / | awk 'NR==2{print $4}')
  log_step "disk" "ok" "{\"usagePct\":$usage,\"free\":\"$free_gb\"}"
  [ "$usage" -lt 90 ]
}

check_memory() {
  local mem_total mem_avail mem_pct
  mem_total=$(free -m | awk '/Mem:/{print $2}')
  mem_avail=$(free -m | awk '/Mem:/{print $7}')
  mem_pct=$(( (mem_total - mem_avail) * 100 / mem_total ))
  log_step "memory" "ok" "{\"totalMB\":$mem_total,\"availMB\":$mem_avail,\"pct\":$mem_pct}"
  [ "$mem_pct" -lt 90 ]
}

pipeline() {
  local all_ok=true
  
  # 步骤1: 检查 Gateway
  check_gateway || all_ok=false
  
  # 步骤2: 检查磁盘
  check_disk || all_ok=false
  
  # 步骤3: 检查内存
  check_memory || all_ok=false
  
  # 汇总
  if $all_ok; then
    log_step "summary" "pass" "{\"allOk\":true}"
    echo "✅ All checks passed — pipeline log: $PIPELINE_LOG"
  else
    log_step "summary" "fail" "{\"allOk\":false}"
    echo "❌ Some checks failed — pipeline log: $PIPELINE_LOG"
    return 1
  fi
}

# CLI入口（仿 lobster exec）
case "${1:-}" in
  gateway) check_gateway ;;
  disk) check_disk ;;
  memory) check_memory ;;
  run|"") pipeline ;;
  json) cat "$PIPELINE_LOG" 2>/dev/null || echo "[]" ;;
  *) echo "Usage: $0 [gateway|disk|memory|run|json]"; exit 1 ;;
esac
