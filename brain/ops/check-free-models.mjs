#!/usr/bin/env node
// 轻量检查：OpenRouter 免费模型有更新吗？
// 被心跳调用，有变化才通知主人

import fs from 'fs';
import https from 'https';
import path from 'path';

const STATE_FILE = path.resolve(import.meta.dirname, '../workspace/memory/heartbeat-state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// 只提取免费模型（prompt=0, completion=0）
function extractFreeModels(data) {
  if (!data || !Array.isArray(data.data)) return [];
  return data.data
    .filter(m => 
      m.pricing &&
      parseFloat(m.pricing.prompt) === 0 &&
      parseFloat(m.pricing.completion) === 0
    )
    .map(m => ({
      id: m.id,
      name: m.name || m.id,
      context_length: m.context_length,
      // 取简短描述
      description: m.description ? m.description.slice(0, 120) : ''
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function fetchModels() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://openrouter.ai/api/v1/models', {
      timeout: 15000,
      headers: { 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('parse failed'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const state = readState();
  if (!state) {
    console.log('HEARTBEAT_STATE: no state file');
    process.exit(0);
  }

  const now = Date.now();
  
  // 距上次检查不足 30 分钟就跳过
  if (state.openrouter_free_models.lastCheckMs &&
      (now - state.openrouter_free_models.lastCheckMs) < 30 * 60 * 1000) {
    process.exit(0);
  }

  let models;
  try {
    models = await fetchModels();
  } catch (e) {
    console.error(`HEARTBEAT_OR_ERR: fetch failed: ${e.message}`);
    process.exit(0);
  }

  const freeModels = extractFreeModels(models);
  const knownIds = new Set(state.openrouter_free_models.knownFreeModels.map(m => m.id));
  const currentIds = new Set(freeModels.map(m => m.id));

  // 比较差异
  const newModelIds = [...currentIds].filter(id => !knownIds.has(id));
  const removedModelIds = [...knownIds].filter(id => !currentIds.has(id));

  // 更新状态
  state.openrouter_free_models.lastCheckMs = now;
  state.openrouter_free_models.knownFreeModels = freeModels;

  if (newModelIds.length > 0 || removedModelIds.length > 0) {
    // 有变化，输出通知信息
    state.openrouter_free_models.checksSinceLastChange = 0;
    saveState(state);

    console.log('HEARTBEAT_OR_CHANGE:');
    if (newModelIds.length > 0) {
      console.log(`⚡ 新增免费模型 (${newModelIds.length}):`);
      newModelIds.forEach(id => {
        const m = freeModels.find(x => x.id === id);
        if (m) {
          const ctx = m.context_length ? `ctx:${(m.context_length/1024).toFixed(0)}K` : '';
          console.log(`  ✅ ${m.name} ${ctx}`);
        }
      });
    }
    if (removedModelIds.length > 0) {
      console.log(`❌ 下架的免费模型 (${removedModelIds.length}):`);
      removedModelIds.forEach(id => console.log(`  ${id}`));
    }
    process.exit(1); // exit 1 signals "there's a change" to the caller
  } else {
    state.openrouter_free_models.checksSinceLastChange++;
    saveState(state);
    console.log(`HEARTBEAT_OR_OK: no change (${freeModels.length} free models tracked)`);
    process.exit(0);
  }
}

main().catch(() => process.exit(0));
