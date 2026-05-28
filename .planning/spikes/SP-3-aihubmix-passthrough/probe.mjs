// .planning/spikes/SP-3-aihubmix-passthrough/probe.mjs
// 验证：AiHubMix passthrough 上游模型 tool_calls 兼容性
//
// 用法：
//   set -a; source /path/to/.env.local; set +a
//   node .planning/spikes/SP-3-aihubmix-passthrough/probe.mjs
//
// 可选环境变量：AIHUBMIX_PROBE_MODEL（默认 gpt-4o）
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

async function loadKeyFromDotEnv() {
  const candidates = [join(here, '../../../.env.local')];
  for (const p of candidates) {
    const txt = await readFile(p, 'utf8').catch(() => '');
    if (!txt) continue;
    const env = Object.fromEntries(
      txt.split('\n').filter(Boolean).filter((l) => !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
    );
    if (env.AIHUBMIX_API_KEY) return env.AIHUBMIX_API_KEY;
  }
  return null;
}

const KEY = process.env.AIHUBMIX_API_KEY || (await loadKeyFromDotEnv());
if (!KEY) { console.error('Missing AIHUBMIX_API_KEY (env or .env.local)'); process.exit(1); }

const MODEL = process.env.AIHUBMIX_PROBE_MODEL || 'gpt-4o';

const tools = [
  {
    type: 'function',
    function: {
      name: 'echo',
      description: '把传入的 text 原样回显',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  },
];

const body = {
  model: MODEL,
  stream: true,
  tools,
  tool_choice: 'auto',
  messages: [{ role: 'user', content: '请用 echo 工具回显「hello」' }],
};

const resp = await fetch('https://api.aihubmix.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify(body),
});

if (!resp.ok) {
  const errText = await resp.text();
  console.error(`HTTP ${resp.status}: ${errText.slice(0, 1000)}`);
  await writeFile(join(here, 'raw-log.txt'), `HTTP ${resp.status}\n${errText}`.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_SK]'));
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
raw = raw.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED_SK]');
raw = raw.replace(/Bearer\s+[A-Za-z0-9_-]+/g, 'Bearer [REDACTED]');

await writeFile(join(here, 'raw-log.txt'), raw);
const hasToolCall = /"tool_calls"\s*:/.test(raw);
const finishReason = raw.match(/"finish_reason"\s*:\s*"(\w+)"/)?.[1] ?? 'unknown';
const toolCallIds = [...raw.matchAll(/"id"\s*:\s*"(call_[A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
const uniqueIds = new Set(toolCallIds);
console.log(`Has tool_calls: ${hasToolCall} | finish_reason: ${finishReason} | model: ${MODEL} | unique tool_call_id: ${uniqueIds.size}`);
