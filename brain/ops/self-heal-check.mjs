#!/usr/bin/env node
/**
 * self-heal-check.mjs — 自学系统健康检查
 * 
 * 用途: 确保自我进化系统正常运行
 * 运行: node ~/.openclaw/scripts/self-heal-check.mjs [--fix]
 */

import { execFileSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

const OK = '✅';
const WARN = '⚠️';
const FAIL = '❌';

const HOME = process.env.HOME;
const WORKSPACE = HOME + '/.openclaw/workspace';
const SCRIPTS = HOME + '/.openclaw/scripts';

const checks = [];
let allOk = true;

function check(name, fn) {
  try {
    const result = fn();
    checks.push({ name, status: result ? OK : FAIL, detail: '' });
    if (!result) allOk = false;
  } catch (e) {
    checks.push({ name, status: FAIL, detail: e.message });
    allOk = false;
  }
}

// === 检查项 ===

check('自学脚本是否存在', () => existsSync(SCRIPTS + '/self-learn.mjs'));

check('自学脚本语法', () => {
  execFileSync('node', ['-c', SCRIPTS + '/self-learn.mjs'], { timeout: 5000 });
  return true;
});

check('crontab 自学任务已注册', () => {
  const crontab = execFileSync('crontab', ['-l'], { encoding: 'utf8', timeout: 5000 });
  return crontab.includes('self-learn.mjs');
});

check('crontab 备份任务已注册', () => {
  const crontab = execFileSync('crontab', ['-l'], { encoding: 'utf8', timeout: 5000 });
  return crontab.includes('backup-brain.mjs before') && crontab.includes('backup-brain.mjs after');
});

check('备份脚本存在', () => existsSync(SCRIPTS + '/backup-brain.mjs'));

check('GitHub brain-backup 分支可访问', () => {
  const out = execFileSync('gh', ['api', 'repos/weixiaobao1976/openclaw-agentics/branches/brain-backup', '--jq', '.name'], { encoding: 'utf8', timeout: 10000 });
  return out.trim() === 'brain-backup';
});

check('本地备份目录存在', () => existsSync(HOME + '/.openclaw/backup/brain'));

check('TOOLS.md 5大模式完整', () => {
  const content = readFileSync(WORKSPACE + '/TOOLS.md', 'utf8');
  const patterns = ['模式1:', '模式2:', '模式3:', '模式4:', '模式5:'];
  return patterns.every(p => content.includes(p));
});

check('MEMORY.md 存在', () => existsSync(WORKSPACE + '/MEMORY.md'));

check('knowledge/ 存档存在', () => existsSync(WORKSPACE + '/knowledge/openclaw-ecosystem.md'));

check('AGENTS.md 自学检查段落', () => {
  const content = readFileSync(WORKSPACE + '/AGENTS.md', 'utf8');
  return content.includes('自学检查');
});

check('gh CLI 可用', () => {
  const out = execFileSync('gh', ['auth', 'status'], { encoding: 'utf8', timeout: 10000 });
  return out.includes('Logged in');
});

check('crontab PATH 包含 gh 路径', () => {
  const crontab = execFileSync('crontab', ['-l'], { encoding: 'utf8', timeout: 5000 });
  const pathLine = crontab.split('\n').find(l => l.startsWith('PATH='));
  return pathLine && pathLine.includes(HOME + '/.local/bin');
});

// === 输出 ===

console.log('\n📊 自学系统健康检查');
console.log('='.repeat(40));
for (const c of checks) {
  console.log(` ${c.status} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
}
console.log('='.repeat(40));
console.log(` ${allOk ? OK : FAIL} 总体: ${allOk ? '全部正常' : '存在问题'}`);
console.log();

// === 自动修复 ===
if (!allOk && process.argv.includes('--fix')) {
  console.log('🔧 尝试自动修复...\n');
  
  for (const c of checks) {
    if (c.status === FAIL) {
      console.log(` 修复: ${c.name}...`);
      
      if (c.name === 'crontab 自学任务已注册') {
        execFileSync('sh', ['-c',
          `(crontab -l 2>/dev/null; echo "0 10 * * 0 cd ~/.openclaw/workspace && node ~/.openclaw/scripts/self-learn.mjs --notify 2>>/tmp/openclaw/self-learn.log") | crontab -`
        ], { timeout: 5000 });
        console.log('  ✅ crontab 已重新添加');
      }
      
      // 其他修复暂略
    }
  }
}

process.exit(allOk ? 0 : 1);