#!/bin/bash
# 全面系统健康报告
echo "╔══════════════════════════════════════════╗"
echo "║     🏥 OpenClaw 全面健康报告             ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "━━━ Gateway ━━━"
systemctl --user is-active openclaw-gateway.service 2>/dev/null
PID=$(ss -tlnp "sport = :18789" 2>/dev/null | grep -oP 'pid=\K[0-9]+')
echo "PID: $PID | uptime: $(ps -o etime= -p $PID 2>/dev/null) | RSS: $(ps -o rss= -p $PID | awk '{printf "%.0f MB", $1/1024}')"
echo ""
echo "━━━ 系统 ━━━"
echo "负载: $(uptime | grep -oP 'load average:.*')"
free -h | grep Mem
df -h / | tail -1
echo ""
echo "━━━ 日志 ━━━"
echo "网关日志: $(du -sh /tmp/openclaw/openclaw-*.log 2>/dev/null | cut -f1)"
echo "维护日志: $(du -sh "$HOME/.openclaw/maintenance/logs/" 2>/dev/null | cut -f1)"
echo ""
echo "━━━ crontab ━━━"
crontab -l 2>/dev/null | grep -v '^#' | grep -v '^$' | wc -l | xargs -I{} echo "{} 个任务"
