// .planning/spikes/SP-1-deepseek-multi-tool/probe.mjs
// 验证：DeepSeek-V4 多 tool 并行返回时 SSE tool_calls accum 按 index 主键无串污染
//
// 用法：
//   set -a; source /path/to/.env.local; set +a
//   node .planning/spikes/SP-1-deepseek-multi-tool/probe.mjs
//
// Key 优先级：process.env.DEEPSEEK_API_KEY > 同目录上溯 .env.local
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

async function loadKeyFromDotEnv() {
  const candidates = [
    join(here, '../../../.env.local'),
  ];
  for (const p of candidates) {
    const txt = await readFile(p, 'utf8').catch(() => '');
    if (!txt) continue;
    const env = Object.fromEntries(
      txt.split('\n').filter(Boolean).filter((l) => !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
    );
    if (env.DEEPSEEK_API_KEY) return env.DEEPSEEK_API_KEY;
  }
  return null;
}

const KEY = process.env.DEEPSEEK_API_KEY || (await loadKeyFromDotEnv());
if (!KEY) { console.error('Missing DEEPSEEK_API_KEY (env or .env.local)'); process.exit(1); }

const tools = [
  {
    type: 'function',
    function: {
      name: 'set_title_slide_1',
      description: '设置第 1 张幻灯片标题',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_title_slide_2',
      description: '设置第 2 张幻灯片标题',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_title_slide_3',
      description: '设置第 3 张幻灯片标题',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  },
];

const body = {
  model: process.env.DEEPSEEK_PROBE_MODEL || 'deepseek-chat',
  stream: true,
  tools,
  tool_choice: 'auto',
  messages: [
    { role: 'system', content: '你可以一次性调用多个 tools 完成任务（parallel tool_calls）。' },
    { role: 'user', content: '同时把 slide 1 标题改成「A」、slide 2 改成「B」、slide 3 改成「C」' },
  ],
};

const resp = await fetch('https://api.deepseek.com/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify(body),
});

if (!resp.ok) {
  const errText = await resp.text();
  console.error(`HTTP ${resp.status}: ${errText.slice(0, 1000)}`);
  process.exit(2);
}

let raw = '';
const reader = resp.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  raw += decoder.decode(value, { stream: true });
}

// 脱敏：去 sk- 模式与任何 Bearer token 残留
raw = raw.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_SK]');
raw = raw.replace(/Bearer\s+[A-Za-z0-9_-]+/g, 'Bearer [REDACTED]');

await writeFile(join(here, 'raw-log.txt'), raw);
console.log('SP-1 raw log written');

// 简单分析：统计 tool_call_id 出现次数
const idMatches = [...raw.matchAll(/"id"\s*:\s*"(call_[A-Za-z0-9_-]+)"/g)];
const uniqueIds = new Set(idMatches.map((m) => m[1]));
const indexMatches = [...raw.matchAll(/"index"\s*:\s*(\d+)/g)];
const uniqueIndexes = new Set(indexMatches.map((m) => m[1]));
const finishReason = raw.match(/"finish_reason"\s*:\s*"(\w+)"/)?.[1] ?? 'unknown';

console.log(`Unique tool_call_id: ${uniqueIds.size}`);
console.log(`Unique tool_call index: ${uniqueIndexes.size}`);
console.log(`finish_reason: ${finishReason}`);
console.log(`Model: ${body.model}`);
