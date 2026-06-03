/**
 * src/agent/compaction.test.ts — Phase 21（CTX-03/04/05）摘要压缩单测
 *
 * 覆盖：estimateTokens 公式 / selectCompactionPlan token 边界（below/at/above HIGH、压后<=LOW、
 * 地板保护、existing summary、toFold 空边界）/ messagesAfterCutoff / buildSummaryMessage /
 * summarizeSegment（只取 delta）/ maybeCompactHistory 编排（往返 + below-HIGH no-op +
 * REVISION 1 abort 半截 no-commit + REVISION 3 摘要超上限 no-commit + messages 未 mutate）。
 *
 * token 构造：estimateTokens(s)=ceil(s.length/1.6)。tokens 取 5 的倍数 → tokens*1.6 为整数 →
 * 'x'.repeat(tokens*1.6) 精确对应 tokens（无 ceil 误差）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// storage mock（maybeCompactHistory 成功后调 saveHistory → storage.set）
vi.mock('../lib/storage', () => ({
  storage: { get: vi.fn().mockReturnValue(null), set: vi.fn(), remove: vi.fn() },
  STORAGE_KEYS: { CHAT_HISTORY_PREFIX: 'aster:chat:' },
}));

import {
  estimateTokens,
  selectCompactionPlan,
  messagesAfterCutoff,
  buildSummaryMessage,
  summarizeSegment,
  maybeCompactHistory,
  COMPACT_HIGH_WATERMARK_TOKENS,
  COMPACT_LOW_WATERMARK_TOKENS,
  RECENT_TURNS_FLOOR,
  SUMMARY_MAX_TOKENS,
} from './compaction';
import { useChatStore, type Message } from '../store/chat';
import type { OpenAICompatibleLLM } from '../providers/openai-compat';

/** 构造 token 量精确可控的消息（tokens 取 5 的倍数）。 */
function makeMsg(id: string, role: 'user' | 'assistant', tokens: number): Message {
  return { id, role, content: 'x'.repeat(tokens * 1.6), ts: 1 };
}

/** 交替 user/assistant 的历史，每条 perMsgTokens。 */
function makeHistory(pairs: number, perMsgTokens: number): Message[] {
  const msgs: Message[] = [];
  for (let i = 0; i < pairs; i++) {
    msgs.push(makeMsg(`u${i}`, 'user', perMsgTokens));
    msgs.push(makeMsg(`a${i}`, 'assistant', perMsgTokens));
  }
  return msgs;
}

function fakeLLM(events: unknown[]): OpenAICompatibleLLM {
  return {
    // eslint-disable-next-line require-yield
    async *streamChat() {
      for (const e of events) yield e as never;
    },
  } as unknown as OpenAICompatibleLLM;
}

const sumTokens = (msgs: Message[]) => msgs.reduce((s, m) => s + estimateTokens(m.content), 0);

describe('estimateTokens — 复用 read-result 既有公式（REVISION 4 DRY）', () => {
  it('ceil(len/1.6)：16 字符 = 10 token', () => {
    expect(estimateTokens('a'.repeat(16))).toBe(10);
  });
  it('更长串 token 更大（单调）', () => {
    expect(estimateTokens('a'.repeat(160))).toBeGreaterThan(estimateTokens('a'.repeat(16)));
  });
});

describe('selectCompactionPlan — token 高水位边界（CTX-03 心脏）', () => {
  it('just-below HIGH → 不压缩（keptRaw===history，toFold 空）', () => {
    // systemPromptTokens=0, history = HIGH-5 token → total = HIGH-5 <= HIGH
    const history = [makeMsg('u0', 'user', COMPACT_HIGH_WATERMARK_TOKENS - 5)];
    const plan = selectCompactionPlan(history, '', 0);
    expect(plan.needsCompaction).toBe(false);
    expect(plan.toFold).toHaveLength(0);
    expect(plan.keptRaw).toBe(history);
  });

  it('at HIGH（=120K，严格 > 才触发）→ 不压缩', () => {
    const history = [makeMsg('u0', 'user', COMPACT_HIGH_WATERMARK_TOKENS)];
    const plan = selectCompactionPlan(history, '', 0);
    expect(plan.needsCompaction).toBe(false);
    expect(plan.toFold).toHaveLength(0);
  });

  it('just-above HIGH → 压缩，toFold 非空，压后 keptRaw <= LOW', () => {
    // 16 对 × 4000 token/条 = 128000 token > HIGH
    const history = makeHistory(16, 4000);
    const plan = selectCompactionPlan(history, '', 0);
    expect(plan.needsCompaction).toBe(true);
    expect(plan.toFold.length).toBeGreaterThan(0);
    expect(sumTokens(plan.keptRaw)).toBeLessThanOrEqual(COMPACT_LOW_WATERMARK_TOKENS);
  });

  it('压后回落 <= LOW（含 system + 摘要 token）', () => {
    const history = makeHistory(16, 4000);
    const systemPromptTokens = 500;
    const existingSummary = 'x'.repeat(800); // 500 token
    const plan = selectCompactionPlan(history, existingSummary, systemPromptTokens);
    expect(plan.needsCompaction).toBe(true);
    const after = systemPromptTokens + estimateTokens(existingSummary) + sumTokens(plan.keptRaw);
    expect(after).toBeLessThanOrEqual(COMPACT_LOW_WATERMARK_TOKENS);
  });

  it('地板保护：最近全是大轮 → keptRaw 仍保留 >= RECENT_TURNS_FLOOR 个 user 轮', () => {
    // 10 对 × 20000 token/条：每对 40000 token » budget(38000) → 预算放不下，floor 兜底
    const history = makeHistory(10, 20000);
    const plan = selectCompactionPlan(history, '', 0);
    expect(plan.needsCompaction).toBe(true);
    const keptUsers = plan.keptRaw.filter((m) => m.role === 'user').length;
    expect(keptUsers).toBeGreaterThanOrEqual(RECENT_TURNS_FLOOR);
  });

  it('existing summary 折叠：传非空 summary，total>HIGH 仍正确切分', () => {
    const history = makeHistory(14, 4000); // 112000 token
    const existingSummary = 'x'.repeat(20000 * 1.6); // 20000 token → total 132000 > HIGH
    const plan = selectCompactionPlan(history, existingSummary, 0);
    expect(plan.needsCompaction).toBe(true);
    expect(plan.toFold.length + plan.keptRaw.length).toBe(history.length); // 切分无丢失
  });

  it('toFold 空边界：仅 <= RECENT_TURNS_FLOOR 轮但 total>HIGH（少量超大轮）→ 不压缩', () => {
    // 3 对 × 50000 token = 300000 > HIGH，但只有 3 个 user 轮（< floor）→ 无更老可折
    const history = makeHistory(3, 50000);
    const plan = selectCompactionPlan(history, '', 0);
    expect(plan.needsCompaction).toBe(false);
    expect(plan.toFold).toHaveLength(0);
  });
});

describe('messagesAfterCutoff', () => {
  const msgs: Message[] = [
    makeMsg('m0', 'user', 5),
    makeMsg('m1', 'assistant', 5),
    makeMsg('m2', 'user', 5),
  ];
  it('throughId=null → 全部', () => {
    expect(messagesAfterCutoff(msgs, null)).toHaveLength(3);
  });
  it('存在的 id → slice 其后', () => {
    const r = messagesAfterCutoff(msgs, 'm1');
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('m2');
  });
  it('不存在的 id（被 quota-trim 删）→ 兜底全部', () => {
    expect(messagesAfterCutoff(msgs, 'ghost')).toHaveLength(3);
  });
});

describe('buildSummaryMessage', () => {
  it('含 marker + 原 summary 文本', () => {
    const out = buildSummaryMessage('要点ABC');
    expect(out).toContain('【对话历史摘要');
    expect(out).toContain('要点ABC');
  });
});

describe('summarizeSegment — 只取 delta，忽略 reasoning/usage', () => {
  it('多个 delta 拼接 trim；reasoning_delta/usage 被忽略', async () => {
    const llm = fakeLLM([
      { type: 'reasoning_delta', content: 'X' },
      { type: 'delta', content: '摘要' },
      { type: 'usage', tokens: 1 },
      { type: 'delta', content: '内容' },
    ]);
    const out = await summarizeSegment(
      llm,
      {},
      [makeMsg('u0', 'user', 5)],
      '',
      new AbortController().signal,
    );
    expect(out).toBe('摘要内容');
  });
});

describe('maybeCompactHistory — 编排 + 防腐（CTX-03/04，REVISION 1/3）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], summary: '', summaryThroughId: null } as never);
  });

  /** 16 条（~25K token/条，合计 400K > HIGH）seed 历史 */
  function seedBig() {
    const seed = Array.from({ length: 16 }, (_, i) =>
      makeMsg(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', 25000),
    );
    useChatStore.setState({ messages: seed, summary: '', summaryThroughId: null } as never);
    return seed;
  }

  it('超 HIGH → 压缩：summary 写入、cutoff 推进、messages 未 mutate', async () => {
    const seed = seedBig();
    await maybeCompactHistory({
      llm: fakeLLM([{ type: 'delta', content: 'SUMMARY' }]),
      cfg: {},
      signal: new AbortController().signal,
      systemPromptTokens: 100,
      docKey: 'aster:chat:t',
    });
    expect(useChatStore.getState().summary).toBe('SUMMARY');
    expect(useChatStore.getState().summaryThroughId).not.toBeNull();
    expect(useChatStore.getState().messages).toHaveLength(seed.length); // 未 mutate UI 历史
  });

  it('below-HIGH → 不压缩（summary 保持空、cutoff null）', async () => {
    useChatStore.setState({
      messages: [makeMsg('u', 'user', 10)],
      summary: '',
      summaryThroughId: null,
    } as never);
    await maybeCompactHistory({
      llm: fakeLLM([{ type: 'delta', content: 'NOPE' }]),
      cfg: {},
      signal: new AbortController().signal,
      systemPromptTokens: 100,
      docKey: 'aster:chat:t',
    });
    expect(useChatStore.getState().summary).toBe('');
    expect(useChatStore.getState().summaryThroughId).toBeNull();
  });

  it('REVISION 1：abort 进行中 → 半截摘要绝不提交（summary/cutoff 不变）', async () => {
    seedBig();
    const ac = new AbortController();
    ac.abort(); // 中断：streamChat 静默 return，summarizeSegment 返回半截累积串
    await maybeCompactHistory({
      llm: fakeLLM([{ type: 'delta', content: '半截摘要…' }]),
      cfg: {},
      signal: ac.signal,
      systemPromptTokens: 100,
      docKey: 'aster:chat:t',
    });
    expect(useChatStore.getState().summary).toBe(''); // 未提交半截串
    expect(useChatStore.getState().summaryThroughId).toBeNull(); // cutoff 未推进
  });

  it('REVISION 3：摘要超 SUMMARY_MAX_TOKENS → no-commit（保持旧 summary/cutoff = 收敛）', async () => {
    const seed = Array.from({ length: 16 }, (_, i) =>
      makeMsg(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', 25000),
    );
    useChatStore.setState({ messages: seed, summary: 'OLD', summaryThroughId: null } as never);
    const tooLong = 'x'.repeat(SUMMARY_MAX_TOKENS * 1.6 + 1000); // estimateTokens > SUMMARY_MAX_TOKENS
    await maybeCompactHistory({
      llm: fakeLLM([{ type: 'delta', content: tooLong }]),
      cfg: {},
      signal: new AbortController().signal,
      systemPromptTokens: 100,
      docKey: 'aster:chat:t',
    });
    expect(useChatStore.getState().summary).toBe('OLD'); // 超上限不提交，保持旧摘要
    expect(useChatStore.getState().summaryThroughId).toBeNull(); // cutoff 不推进
  });
});
