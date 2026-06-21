#!/usr/bin/env node
/**
 * 🧬 check-and-push-brain.mjs
 *
 * 检测 OpenClaw 版本变化，有更新则自动跑脑镜像推送
 *
 * 用法:
 *   node ~/.openclaw/scripts/check-and-push-brain.mjs
 *
 * 返回值:
 *   0 → 无更新，跳过
 *   1 → 检测到更新，推送完成
 *   2 → 执行出错
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const HOME = homedir();
const STATE_FILE = join(HOME, '.openclaw', 'last-version.txt');
const BACKUP_SCRIPT = join(HOME, '.openclaw', 'scripts', 'backup-brain.mjs');
const NOTIFY_FILE = join(HOME, '.openclaw', 'workspace', '_version-update-notified');

function getCurrentVersion() {
  try {
    const out = execSync('openclaw --version 2>/dev/null || npm list -g openclaw 2>/dev/null | grep openclaw', {
      encoding: 'utf8',
      timeout: 10000,
    }).trim();
    // "OpenClaw 2026.5.27 (a374c3a)" → "2026.5.27"
    const match = out.match(/(\d{4}\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function getLastVersion() {
  if (!existsSync(STATE_FILE)) return null;
  const raw = readFileSync(STATE_FILE, 'utf8').trim();
  return raw || null;
}

function saveVersion(version) {
  mkdirSync(join(HOME, '.openclaw'), { recursive: true });
  writeFileSync(STATE_FILE, version + '\n', 'utf8');
}

function runBackup() {
  try {
    execSync(`node "${BACKUP_SCRIPT}"`, {
      stdio: 'inherit',
      timeout: 120000,
      cwd: join(HOME, '.openclaw', 'workspace'),
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────
const current = getCurrentVersion();
if (!current) {
  console.error('[check-brain] ❌ 无法获取 OpenClaw 版本');
  process.exit(2);
}

const last = getLastVersion();

if (last && last === current) {
  console.log(`[check-brain] 版本未变 (${current})，跳过`);
  process.exit(0);
}

if (!last) {
  console.log(`[check-brain] 首次运行，记录版本 ${current}，跳过推送`);
  saveVersion(current);
  process.exit(0);
}

// 版本有变化！
console.log(`[check-brain] 🆕 检测到版本变更: ${last} → ${current}`);

const ok = runBackup();

if (ok) {
  saveVersion(current);
  // 写入通知标记，静默推送时会检查此文件
  writeFileSync(NOTIFY_FILE, current + '\n', 'utf8');
  console.log(`[check-brain] ✅ 脑镜像已推送 (${current})`);
  process.exit(1);
} else {
  console.error(`[check-brain] ❌ 推送失败`);
  process.exit(2);
}
