#!/usr/bin/env node
/**
 * json-report.mjs — JSON-first 状态报告生成器（参考 gogcli 模式）
 * 
 * 原则：
 * - stdout 只输出 JSON（机器可解析）
 * - stderr 输出人类友好的提示（可选）
 * - 支持 --json / --pretty / --plain 三种输出格式
 */
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
const format = args.includes('--pretty') ? 'pretty' 
  : args.includes('--plain') ? 'plain' : 'json';

function collect() {
  const report = {
    timestamp: new Date().toISOString(),
    hostname: execFileSync('hostname', [], {encoding:'utf8'}).trim(),
    gateway: null,
    system: null,
  };

  // Gateway 状态（端口18789）
  try {
    const ss = execFileSync('ss', ['-tlnp', 'sport = :18789'], {encoding:'utf8'});
    const pid = ss.match(/pid=(\d+)/)?.[1];
    if (pid) {
      const ps = execFileSync('ps', ['-o', 'rss=,etime=', '-p', pid], {encoding:'utf8'}).trim().split(/\s+/);
      report.gateway = { pid: parseInt(pid), memMB: parseInt(ps[0]||0), uptime: ps[1]||'0' };
    }
  } catch { report.gateway = null; }

  // 系统状态
  const load = execFileSync('cat', ['/proc/loadavg'], {encoding:'utf8'}).trim().split(/\s+/);
  const mem = execFileSync('free', ['-m'], {encoding:'utf8'}).split('\n')[1].split(/\s+/);
  const disk = execFileSync('df', ['-h', '/'], {encoding:'utf8'}).split('\n')[1].split(/\s+/);
  
  report.system = {
    loadAvg: { '1min': load[0], '5min': load[1], '15min': load[2] },
    memory: { totalMB: parseInt(mem[1]), usedMB: parseInt(mem[2]), freeMB: parseInt(mem[3]) },
    disk: { usagePct: disk[4], free: disk[3] },
    uptime: execFileSync('uptime', ['-p'], {encoding:'utf8'}).trim().replace(/^up\s+/,''),
  };

  return report;
}

// 输出模式（参考 gogcli 的 --json/--plain 区分）
const report = collect();
if (format === 'pretty') {
  console.log(JSON.stringify(report, null, 2));
} else if (format === 'plain') {
  // plain 模式：人类可读摘要输出到 stdout，JSON 输出到 stderr
  const g = report.gateway;
  const s = report.system;
  console.log(`Gateway: ${g ? `PID ${g.pid}, ${g.memMB}MB, up ${g.uptime}` : 'OFFLINE'}`);
  console.log(`Load: ${s.loadAvg['1min']} / ${s.loadAvg['5min']} / ${s.loadAvg['15min']}`);
  console.log(`Memory: ${s.memory.usedMB}/${s.memory.totalMB}MB`);
  console.log(`Disk: ${s.disk.usagePct} (${s.disk.free} free)`);
  console.error(JSON.stringify(report)); // JSON 走 stderr
} else {
  process.stdout.write(JSON.stringify(report) + '\n');
}
