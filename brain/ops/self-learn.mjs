#!/usr/bin/env node
/**
 * self-learn.mjs — 自学引擎
 * 
 * 每轮执行：
 * 1. 爬 GitHub 搜索 openclaw 相关高星项目
 * 2. 对比 knowledge/openclaw-ecosystem.md 看哪些是新项目
 * 3. 识别新项目 → 写入 MEMORY.md 待深入学习
 * 
 * 用法: node self-learn.mjs [--notify]
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const HOME = process.env.HOME;
const WORKSPACE = HOME + '/.openclaw/workspace';
const MEMORY_FILE = WORKSPACE + '/MEMORY.md';
const KNOWLEDGE_FILE = WORKSPACE + '/knowledge/openclaw-ecosystem.md';

if (!existsSync(WORKSPACE + '/knowledge')) mkdirSync(WORKSPACE + '/knowledge', { recursive: true });

function getKnownProjects() {
  if (!existsSync(KNOWLEDGE_FILE)) return new Set();
  const known = new Set();
  for (const m of readFileSync(KNOWLEDGE_FILE, 'utf8').matchAll(/### (\d+)\. (\S+)/g)) {
    known.add(m[2].toLowerCase());
  }
  return known;
}

function log(msg) { console.error('[self-learn] ' + msg); }

function searchGithub() {
  const out = execFileSync('gh', [
    'search', 'repos', 'openclaw',
    '--owner', 'openclaw',
    '--sort', 'stars',
    '--limit', '15',
    '--json', 'name,owner,stargazersCount,description,url',
  ], { encoding: 'utf8', timeout: 15000 });
  return JSON.parse(out);
}

function updateMemoryMd(newLearnings) {
  if (!newLearnings.length) return;
  let content = existsSync(MEMORY_FILE) ? readFileSync(MEMORY_FILE, 'utf8') : '';
  
  // 去重：跳过已在 MEMORY.md 出现的项目
  const knownLines = new Set(content.split('\n').filter(l => l.startsWith('- **')));
  const toAdd = newLearnings.filter(l => {
    const line = `- **${l.project}** (⭐${l.stars}): ${l.insight}`;
    return !knownLines.has(line);
  });
  
  if (!toAdd.length) {
    log('所有新项目已在 MEMORY.md 中，跳过追加');
    return;
  }
  
  content += `\n## 📚 学习更新 (${new Date().toISOString().slice(0, 10)})\n\n`;
  for (const l of toAdd) {
    content += `- **${l.project}** (⭐${l.stars}): ${l.insight}\n`;
  }
  content += '\n';
  writeFileSync(MEMORY_FILE, content);
  log(`MEMORY.md 追加了 ${toAdd.length} 个项目`);
}

function main() {
  const notify = process.argv.includes('--notify');
  const known = getKnownProjects();
  log('已学项目数: ' + known.size);

  const repos = searchGithub();
  log('GitHub 搜索到 ' + repos.length + ' 个项目');

  // 跳过大路货
  const skipNames = new Set([
    'openclaw', 'clawhub', 'clawsweeper',
    'gogcli', 'peekaboo', 'lobster', 'imsg', 'wacli', 'mcporter',
    'nix-openclaw', 'openclaw-ansible',
    'openclaw-windows-node', 'slacrawl', 'community',
    'gbrain', 'openviking', 'planning-with-files',
    'zeroclaw', 'nanoclaw', 'nemoclaw',
  ]);

  const realNew = repos.filter(r =>
    !skipNames.has(r.name.toLowerCase()) &&
    !known.has(r.name.toLowerCase()) &&
    r.owner.login === 'openclaw' &&
    r.stargazersCount >= 100
  );

  const topProjects = repos.slice(0, 10).map(r => ({
    name: r.name, owner: r.owner.login, stars: r.stargazersCount,
  }));

  const result = {
    timestamp: new Date().toISOString(),
    totalRepos: repos.length,
    newProjects: realNew.length,
    knownProjects: known.size,
    topProjects,
    newOnes: realNew.map(r => ({ name: r.name, stars: r.stargazersCount, url: r.url })),
  };

  if (realNew.length > 0) {
    log('发现 ' + realNew.length + ' 个新项目!');
    for (const p of realNew) {
      log('  ⭐' + p.stargazersCount + ' ' + p.name + ': ' + (p.description || '').slice(0, 80));
    }
    updateMemoryMd(realNew.map(p => ({
      project: 'openclaw/' + p.name,
      stars: p.stargazersCount,
      insight: (p.description || '').slice(0, 80),
    })));
  } else {
    log('没有发现新项目');
  }

  process.stdout.write(JSON.stringify(result) + '\n');

  if (notify && realNew.length > 0) {
    try {
      execFileSync('openclaw', [
        'message', 'send',
        '--target', 'telegram:178274859',
        '--message', '🔍 自学引擎发现 ' + realNew.length + ' 个新 OpenClaw 项目: ' +
          realNew.map(p => p.name).join(', ') + '，等待深入学习',
      ], { timeout: 10000 });
    } catch (e) { log('notify fail: ' + e.message); }
  }
}

main();