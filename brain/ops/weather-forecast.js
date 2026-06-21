#!/usr/bin/env node

/**
 * 花都区天气预报定时任务 v3
 * 重试+超时，execFileSync 避免 shell 转义
 */

const https = require('https');
const { execSync, execFileSync } = require('child_process');

const RETRY_MAX = 3;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 15000;

function fetchWithRetry(url) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
      req.on('error', err => {
        console.error(`网络错误(尝试${RETRY_MAX - n + 1}/${RETRY_MAX}): ${err.message}`);
        if (n > 1) setTimeout(() => attempt(n - 1), RETRY_DELAY_MS);
        else reject(err);
      });
      req.on('timeout', () => {
        req.destroy();
        console.error(`超时(尝试${RETRY_MAX - n + 1}/${RETRY_MAX})`);
        if (n > 1) setTimeout(() => attempt(n - 1), RETRY_DELAY_MS);
        else reject(new Error('请求超时'));
      });
    };
    attempt(RETRY_MAX);
  });
}

async function getForecast() {
  const raw = await fetchWithRetry('https://wttr.in/Huadu?format=j1&lang=zh');
  if (!raw.trim().startsWith('{')) throw new Error('非JSON响应: ' + raw.substring(0, 80));
  const d = JSON.parse(raw);
  if (!d.current_condition?.[0] || !d.weather?.[0]) throw new Error('数据不完整');
  return d;
}

function formatMsg(d) {
  const c = d.current_condition[0];
  const t = d.weather[0];
  const tm = d.weather[1];
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  return [
    '🌤️ 花都区天气预报',
    '',
    '📍 当前天气：',
    `• 温度：${c.temp_C}°C | 体感 ${c.FeelsLikeC}°C`,
    `• 湿度：${c.humidity}% | 风速：${c.windspeedKmph} km/h`,
    `• 状况：${c.weatherDesc[0].value}`,
    '',
    `📅 今日 (${t.date})`,
    `  ☀️ 白天 ${t.hourly[4]?.weatherDesc[0]?.value || '?'}`,
    `  🌙 夜间 ${t.hourly[7]?.weatherDesc[0]?.value || '?'}`,
    `  🔺 最高 ${t.maxtempC || t.avgtempC || '?'}°C  🔻 最低 ${t.mintempC || t.avgtempC || '?'}°C`,
    '',
    `📅 明日 (${tm.date})`,
    `  ☀️ 白天 ${tm.hourly[4]?.weatherDesc[0]?.value || '?'}`,
    `  🌙 夜间 ${tm.hourly[7]?.weatherDesc[0]?.value || '?'}`,
    `  🔺 最高 ${tm.maxtempC || tm.avgtempC || '?'}°C  🔻 最低 ${tm.mintempC || tm.avgtempC || '?'}°C`,
    '',
    `⏰ ${now}`
  ].join('\n');
}

function send(msg) {
  // execFileSync 传数组参数，不用 shell 解析
  execFileSync('openclaw', [
    'message', 'send',
    '--channel', 'telegram',
    '--target', '178274859',
    '--message', msg
  ], { timeout: 15000, stdio: 'pipe' });
  console.log('发送成功 ✅');
}

async function main() {
  let errMsg = '';
  try {
    console.log('🌤️ 获取天气...');
    const data = await getForecast();
    const msg = formatMsg(data);
    console.log('📤 发送...');
    send(msg);
    console.log('完成');
  } catch (err) {
    console.error('失败:', err.message);
    errMsg = `❌ 天气预报获取失败\n\n${err.message}\n${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
  }
  if (errMsg) {
    try { send(errMsg); } catch {}
    process.exit(1);
  }
}

main();