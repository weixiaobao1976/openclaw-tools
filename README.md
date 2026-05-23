# 🔧 OpenClaw 运维工具集

> backup / monitor / model管理 / 自动修复

## 📋 分支规划

| 分支 | 内容 |
|------|------|
| `main` | 总览 + 索引 |
| `backup` | 配置/凭证/workspace 分层备份脚本 |
| `monitor` | 系统监控守护脚本（gateway/disk/load/network）|
| `model` | 模型管理脚本（自动发现/健康检查/自动切换）|
| `auto-repair` | 自动修复脚本（crontab PATH / 日志轮转 / stale清理）|
| `health-dashboard` | 健康仪表盘（格式化的状态报告）|

## 🚀 快速安装

```bash
# clone 到本地
git clone https://github.com/weixiaobao1976/openclaw-tools.git ~/.openclaw/tools
cd ~/.openclaw/tools

# 安装监控脚本（已有 -> 覆盖更新）
cp -r monitor/scripts/* ~/.openclaw/monitor-scripts/
crontab monitor/crontab/crontab-monitor.txt

# 安装备份脚本
cp backup/scripts/* ~/.openclaw/scripts/
```

## 📦 已沉淀的工具

### backup — 配置备份

| 脚本 | 说明 | 频率 |
|------|------|------|
| `backup-config.sh` | 分层备份（L0/L1/L2） | 按需 + 每日 |
| `backup-rotate.sh` | 旧备份清理（保留最近N个） | 每周 |
| `backup-restore.sh` | 从备份恢复全部配置 | 按需 |

### monitor — 系统监控

| 脚本 | 说明 | 频率 |
|------|------|------|
| `gateway-check.sh` | Gateway 进程守护（ss端口精确查PID） | 每5分钟 |
| `disk-check.sh` | 磁盘空间告警 | 每30分钟 |
| `load-check.sh` | CPU负载 + 内存告警 | 每15分钟 |
| `network-check.sh` | 网络连通性（Telegram/GitHub/Google） | 每15分钟 |
| `check-network.sh` | 启动前网络就绪检查 | 服务启动时 |

### model — 模型管理

| 脚本 | 说明 | 频率 |
|------|------|------|
| `auto-discover.sh` | 模型自动发现 + 缓存更新 | 每周 |
| `health-check.sh` | 各角色模型健康检查 + 自动切换 | 每天 |
| `model-report.sh` | 模型状态报告 | 按需 |

### health — 健康报告

| 脚本 | 说明 |
|------|------|
| `full-report.sh` | 全面系统健康报告（uptime/df/free/journalctl）|

## 🔗 相关项目

- [openclaw-techniques](https://github.com/weixiaobao1976/openclaw-techniques) — 技术实战文档库
- [openclaw-agentics](https://github.com/weixiaobao1976/openclaw-agentics) — 技能/自动化项目

---

**维护中... 持续沉淀运维经验** 🐺