#!/usr/bin/env node
/**
 * backup-brain.mjs — 学习前备份 + 学习后镜像
 * 
 * 用途：每次学习前把当前知识状态完整备份到 GitHub，学习后再推一次增量
 * 确保进化过程持久、可回滚、跨设备同步
 * 
 * 用法: 
 *   node backup-brain.mjs before   # 学习前：备份当前状态
 *   node backup-brain.mjs after    # 学习后：推送增量更新
 *   node backup-brain.mjs status   # 查看备份状态
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { homedir } from 'os';

const HOME = homedir();
const WORKSPACE = HOME + '/.openclaw/workspace';
const BACKUP_DIR = HOME + '/.openclaw/backup/brain';
const SCRIPTS_DIR = HOME + '/.openclaw/scripts';
const MONITOR_DIR = HOME + '/.openclaw/monitor-scripts';
const KNOWLEDGE_DIR = WORKSPACE + '/knowledge';
const SKILLS_DIR = WORKSPACE + '/skills';
const MEMORY_DIR = WORKSPACE + '/memory';
const CONFIG_DIR = WORKSPACE + '/config';

const GH_USER = 'weixiaobao1976';

// === 扫描所有技能文件 ===
function scanSkills() {
  const skills = [];
  if (existsSync(SKILLS_DIR)) {
    for (const dir of readdirSync(SKILLS_DIR)) {
      const skillFile = SKILLS_DIR + '/' + dir + '/SKILL.md';
      if (existsSync(skillFile)) {
        skills.push({ src: skillFile, repo: 'openclaw-agentics', path: 'skills/' + dir + '.skill.md' });
      }
    }
  }
  return skills;
}

// === 扫描所有知识库文件 ===
function scanKnowledge() {
  const files = [];
  if (existsSync(KNOWLEDGE_DIR)) {
    for (const f of readdirSync(KNOWLEDGE_DIR)) {
      const fullPath = KNOWLEDGE_DIR + '/' + f;
      if (existsSync(fullPath) && !f.startsWith('.')) {
        files.push({ src: fullPath, repo: 'openclaw-techniques', path: 'knowledge/' + f });
      }
    }
  }
  return files;
}

// === 扫描所有 memory 文件 ===
function scanMemory() {
  const files = [];
  if (existsSync(MEMORY_DIR)) {
    for (const f of readdirSync(MEMORY_DIR)) {
      const fullPath = MEMORY_DIR + '/' + f;
      if (existsSync(fullPath) && f.endsWith('.md')) {
        files.push({ src: fullPath, repo: 'openclaw-techniques', path: 'memory/' + f });
      }
    }
  }
  return files;
}

// === 扫描所有脚本 ===
function scanScripts() {
  const files = [];
  if (existsSync(SCRIPTS_DIR)) {
    for (const f of readdirSync(SCRIPTS_DIR)) {
      const fullPath = SCRIPTS_DIR + '/' + f;
      if (existsSync(fullPath) && (f.endsWith('.mjs') || f.endsWith('.sh') || f.endsWith('.js'))) {
        files.push({ src: fullPath, repo: 'openclaw-tools', path: 'ops/' + f });
      }
    }
  }
  return files;
}

// === 扫描所有 config 文件 ===
function scanConfig() {
  const files = [];
  if (existsSync(CONFIG_DIR)) {
    for (const f of readdirSync(CONFIG_DIR)) {
      const fullPath = CONFIG_DIR + '/' + f;
      if (existsSync(fullPath) && f.endsWith('.sh')) {
        files.push({ src: fullPath, repo: 'openclaw-tools', path: 'config/' + f });
      }
    }
  }
  return files;
}

// === 构建完整文件列表 ===
function buildCoreFiles() {
  const files = [
    // ===== agentics: 行为规范 =====
    { src: WORKSPACE + '/TOOLS.md',     repo: 'openclaw-agentics', path: 'configs/tools.md' },
    { src: WORKSPACE + '/MEMORY.md',    repo: 'openclaw-agentics', path: 'configs/memory.md' },
    { src: WORKSPACE + '/AGENTS.md',    repo: 'openclaw-agentics', path: 'configs/agents.md' },
    { src: WORKSPACE + '/USER.md',      repo: 'openclaw-agentics', path: 'configs/user.md' },
    { src: WORKSPACE + '/SOUL.md',      repo: 'openclaw-agentics', path: 'configs/soul.md' },
    { src: WORKSPACE + '/IDENTITY.md',  repo: 'openclaw-agentics', path: 'configs/identity.md' },
    { src: WORKSPACE + '/HEARTBEAT.md', repo: 'openclaw-agentics', path: 'configs/heartbeat.md' },
    { src: WORKSPACE + '/TROUBLESHOOTING.md', repo: 'openclaw-agentics', path: 'configs/troubleshooting.md' },

    // ===== agentics: boot 脚本（brain 子目录 + 根目录双份，确保 curl URL 可达） =====
    { src: WORKSPACE + '/boot/bootstrap.sh', repo: 'openclaw-agentics', path: 'boot/bootstrap.sh' },
    { src: WORKSPACE + '/boot/bootstrap.sh', repo: 'openclaw-agentics', path: '../../boot/bootstrap.sh' },

    // ===== agentics: manifest =====
    // ===== agentics: 所有技能 =====
    ...scanSkills(),

    // ===== techniques: 知识库 =====
    ...scanKnowledge(),

    // ===== techniques: 每日日志 =====
    ...scanMemory(),

    // ===== tools: 运维脚本 =====
    ...scanScripts(),

    // ===== tools: 配置工具 =====
    ...scanConfig(),

    // ===== tools: 监控脚本 =====
    { src: MONITOR_DIR + '/gateway-check.sh', repo: 'openclaw-tools', path: 'ops/gateway-check.sh' },

    // ===== web: 面板骨架 =====
  ];

  // 去重（同一 src 只保留一份）
  const seen = new Set();
  return files.filter(f => {
    const key = f.path;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function log(msg) { console.error('[backup-brain] ' + msg); }
function ts() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

// === 1. 本地备份 ===
function backupLocal(CORE_FILES) {
  const stamp = ts();
  const dir = BACKUP_DIR + '/' + stamp;
  ensureDir(dir);

  const info = { timestamp: stamp, files: [] };
  let count = 0;
  for (const f of CORE_FILES) {
    if (existsSync(f.src)) {
      const dest = dir + '/' + f.path.replace(/\//g, '_');
      ensureDir(dir);
      cpSync(f.src, dest);
      info.files.push({ name: f.path, size: readFileSync(f.src).length });
      count++;
    }
  }
  writeFileSync(dir + '/_manifest.json', JSON.stringify(info, null, 2));
  
  // 也复制一份到 workspace 根目录（方便 bootstrap 下载）
  cpSync(dir + '/_manifest.json', WORKSPACE + '/_manifest.json');
  
  // 清理旧备份（保留最近 30 份）
  const all = readdirSync(BACKUP_DIR)
    .filter(n => /^\d{4}-\d{2}-\d{2}T/.test(n))
    .sort().reverse();
  if (all.length > 30) {
    for (const old of all.slice(30)) {
      cpSync(BACKUP_DIR + '/' + old, '/tmp/old-brain-backup-' + old, { recursive: true, force: true });
      rmSync(BACKUP_DIR + '/' + old, { recursive: true, force: true });
    }
    log('清理了 ' + (all.length - 30) + ' 个旧备份');
  }

  log('本地备份完成: ' + dir + ' (' + count + ' 个文件)');
  return stamp;
}

// === 2. GitHub 镜像推送 ===
function pushToGithub(CORE_FILES, phase) {
  const branchName = 'brain-backup';
  const tmpDir = '/tmp/brain-sync-' + ts();
  
  let pushed = 0;
  for (const f of CORE_FILES) {
    if (!existsSync(f.src)) continue;
    
    const repo = f.repo;
    const repoDir = tmpDir + '/' + repo;
    
    if (!existsSync(repoDir)) {
      try {
        execFileSync('git', ['clone', 
          'https://github.com/' + GH_USER + '/' + repo + '.git',
          repoDir,
          '--branch', branchName,
          '--single-branch',
        ], { timeout: 15000, stdio: 'pipe' });
      } catch {
        execFileSync('git', ['clone',
          'https://github.com/' + GH_USER + '/' + repo + '.git',
          repoDir,
          '--single-branch',
        ], { timeout: 15000, stdio: 'pipe' });
        execFileSync('git', ['checkout', '-b', branchName], { cwd: repoDir, timeout: 5000 });
      }
      execFileSync('git', ['config', 'user.email', GH_USER + '@users.noreply.github.com'], { cwd: repoDir });
      execFileSync('git', ['config', 'user.name', GH_USER], { cwd: repoDir });
    }

    const destPath = repoDir + '/brain/' + f.path;
    ensureDir(destPath.substring(0, destPath.lastIndexOf('/')));
    if (existsSync(f.src)) {
      cpSync(f.src, destPath);
    }
  }

  // 确保 .gitignore 不阻挡 _manifest.json
  for (const repo of [...new Set(CORE_FILES.map(f => f.repo))]) {
    const repoDir = tmpDir + '/' + repo;
    const gi = repoDir + '/.gitignore';
    if (existsSync(gi)) {
      let content = readFileSync(gi, 'utf8');
      if (content.includes('*.json') && !content.includes('!_manifest.json')) {
        content += '\n# 允许 manifest 被追踪\n!_manifest.json\n';
        writeFileSync(gi, content);
      }
    }
  }

  for (const repo of [...new Set(CORE_FILES.map(f => f.repo))]) {
    const repoDir = tmpDir + '/' + repo;
    try {
      execFileSync('git', ['add', '-A'], { cwd: repoDir, timeout: 5000 });
      execFileSync('git', ['commit', '--allow-empty', '-m',
        `🧠 ${phase === 'before' ? '学习前' : '学习后'}脑镜像 @ ${ts()}`
      ], { cwd: repoDir, timeout: 5000 });
      execFileSync('git', ['push', '--force', 'origin', branchName], { cwd: repoDir, timeout: 120000 });
      pushed++;
      log(repo + '/' + branchName + ' 已推送');
    } catch (e) {
      log(repo + ' 推送失败: ' + e.message);
    }
  }

  try { execFileSync('rm', ['-rf', tmpDir]); } catch {}
  return pushed;
}

// === 3. 输出 mirror-sync.sh ===
function writeMirrorSync() {
  const script = `#!/usr/bin/env bash
# ============================================================================
# mirror-sync.sh — GitHub 镜像同步
# 用法: bash mirror-sync.sh [auto]
#   auto: 后台运行，日志记录
# ============================================================================
set -euo pipefail

GH_USER="${GH_USER}"
BRANCH="brain-backup"
WORKSPACE="\$HOME/.openclaw/workspace"
LOG="\$HOME/.openclaw/logs/mirror-sync.log"
mkdir -p "\$(dirname "\$LOG")"

echo "[\$(date '+%Y-%m-%d %H:%M:%S')] 🔄 同步开始" | tee -a "\$LOG"

# 如果提供 auto 参数，后台运行
if [ "\${1:-}" = "auto" ]; then
    nohup bash "\$0" > "\$LOG" 2>&1 &
    echo "[\$(date '+%Y-%m-%d %H:%M:%S')] ✅ 后台同步已启动 (PID \$!)" 
    exit 0
fi

node \$HOME/.openclaw/scripts/backup-brain.mjs before 2>&1 | tee -a "\$LOG"

echo "[\$(date '+%Y-%m-%d %H:%M:%S')] ✅ 同步完成" | tee -a "\$LOG"
`;

  const mirrorPath = SCRIPTS_DIR + '/mirror-sync.sh';
  writeFileSync(mirrorPath, script);
  try { execFileSync('chmod', ['+x', mirrorPath]); } catch {}
  log('mirror-sync.sh 已生成');

  // 加入 CORE_FILES 返回
  return { src: mirrorPath, repo: 'openclaw-tools', path: 'ops/mirror-sync.sh' };
}

// === 4. 输出 crontab 参考 ===
function writeCrontabRef(CORE_FILES) {
  // 把当前 crontab 导出为参考文件
  try {
    const cron = execFileSync('crontab', ['-l'], { encoding: 'utf8', timeout: 5000 });
    const refPath = SCRIPTS_DIR + '/crontab-reference.txt';
    writeFileSync(refPath, cron);
    log('crontab 已导出为参考');
    return { src: refPath, repo: 'openclaw-tools', path: 'ops/crontab-reference.txt' };
  } catch {
    return null;
  }
}

// === 状态查看 ===
function showStatus(manifest) {
  const all = existsSync(BACKUP_DIR) ? readdirSync(BACKUP_DIR).filter(n => /^\d{4}-\d{2}-\d{2}T/.test(n)).sort() : [];
  const latest = all.length > 0 ? all[all.length - 1] : null;
  
  let latestManifest = {};
  let latestFiles = [];
  if (latest && existsSync(BACKUP_DIR + '/' + latest + '/_manifest.json')) {
    latestManifest = JSON.parse(readFileSync(BACKUP_DIR + '/' + latest + '/_manifest.json', 'utf8'));
    latestFiles = latestManifest.files || [];
  }

  const result = {
    totalBackups: all.length,
    latestBackup: latest,
    totalFiles: latestFiles.length,
    fileCategories: {
      configs: latestFiles.filter(f => f.name.startsWith('configs')).length,
      skills: latestFiles.filter(f => f.name.startsWith('skills')).length,
      knowledge: latestFiles.filter(f => f.name.startsWith('knowledge')).length,
      memory: latestFiles.filter(f => f.name.startsWith('memory')).length,
      ops: latestFiles.filter(f => f.name.startsWith('ops')).length,
      boot: latestFiles.filter(f => f.name.startsWith('boot')).length,
      config: latestFiles.filter(f => f.name.startsWith('config')).length,
    },
    diskUsage: all.length + ' 份备份',
    remoteBranches: ['openclaw-agentics', 'openclaw-techniques', 'openclaw-tools', 'openclaw-web']
      .map(r => GH_USER + '/' + r + '/' + 'brain-backup'),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

// === 主入口 ===
const cmd = process.argv[2] || 'before';

const CORE_FILES = buildCoreFiles();

if (cmd === 'before') {
  log('🔄 学习前备份开始...');
  const stamp = backupLocal(CORE_FILES);
  
  // 添加 manifest（backupLocal 刚生成）
  const filesWithManifest = [
    ...CORE_FILES,
    { src: WORKSPACE + '/_manifest.json', repo: 'openclaw-agentics', path: '_manifest.json' },
  ];  
  const pushed = pushToGithub(filesWithManifest, 'before');
  log('✅ 学习前备份完成 (' + pushed + ' 个仓库已镜像)');
  
} else if (cmd === 'after') {
  log('🔄 学习后增量推送...');
  const pushed = pushToGithub(CORE_FILES, 'after');
  log('✅ 学习后推送完成 (' + pushed + ' 个仓库已同步)');
  
} else if (cmd === 'status') {
  const all = existsSync(BACKUP_DIR) ? readdirSync(BACKUP_DIR).filter(n => /^\d{4}-\d{2}-\d{2}T/.test(n)).sort() : [];
  const latest = all.length > 0 ? all[all.length - 1] : null;
  let latestManifest = {};
  if (latest && existsSync(BACKUP_DIR + '/' + latest + '/_manifest.json')) {
    latestManifest = JSON.parse(readFileSync(BACKUP_DIR + '/' + latest + '/_manifest.json', 'utf8'));
  }
  showStatus(latestManifest);
  
} else if (cmd === 'setup-mirror') {
  // 生成 mirror-sync.sh 和 crontab 参考
  const extraFiles = [];
  const ms = writeMirrorSync();
  if (ms) extraFiles.push(ms);
  const cr = writeCrontabRef();
  if (cr) extraFiles.push(cr);
  
  // 推送这两个新文件
  if (extraFiles.length > 0) {
    const allFiles = [...CORE_FILES, ...extraFiles];
    log('推送到 GitHub (' + extraFiles.length + ' 个新文件)...');
    const pushed = pushToGithub(allFiles, 'before');
    log('✅ mirror-sync 设置完成 (' + pushed + ' 个仓库已同步)');
  }
  
} else {
  console.error('用法: node backup-brain.mjs [before|after|status|setup-mirror]');
  process.exit(1);
}