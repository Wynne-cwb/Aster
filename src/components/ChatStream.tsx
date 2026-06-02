/**
 * src/components/ChatStream.tsx — 聊天流（Phase 2 Wave 5 + Plan 06 chat-ui-cleanup）
 *
 * 无消息：teal 空态（logo pulse 动画 + 标题 + 副文案，无 chips —— D-03）。
 * 有消息：按 role 分发渲染：
 *   - user / assistant / error → ChatBubble
 *   - tool（含 soft-landing）  → ToolResultCard（本文件内子组件）
 *
 * 新消息时自动滚到底部（useEffect）。
 *
 * G-03 粘底状态机：
 *   - 初始 stickToBottom=true（首次渲染就粘底）
 *   - 用户向上滚动（scrollTop + clientHeight < scrollHeight - 8）→ stickToBottom=false
 *   - 用户滚回底部（差 ≤8px）→ stickToBottom=true（恢复粘底）
 *   - 流式 delta 追加（messages 引用变化）→ 仅 stickToBottom 时自动滚
 *   - 新消息（messages.length 增加）→ 始终强制滚到底（无论 stickToBottom）
 *
 * Plan 06（D-08 / D-09）— role='tool' 渲染：
 *   - 常规 tool（append_paragraph 等）：折叠卡 header 显示 message.content（humanLabel
 *     中文人话，loop.ts 双路径 push 时写入）；点 header 展开 toolResult JSON。
 *   - soft-landing（toolName='soft-landing'）：特殊卡片，两按钮「继续 N 步」/「停下」，
 *     分别调 useAgentStore.continueRun / abort('user')。loop.ts hit MAX_STEPS 时 push
 *     此消息，agentStatus='soft-landing'，等待用户决策（不自动 abort）。
 *
 * Phase 04.1 重皮（Wave 3）：
 *   - empty-state：logo pulse（4s）+ 标题 + 副文案，无 suggestion chips（D-03）
 *   - ToolResultCard：ChevronDownIcon SVG 取代 ▸/▾ 字符，wb-action-head/wb-action-body 范式（D-05）
 *   - CIRCUIT_OPEN 红卡：err-bubble 视觉范式，无假撤销按钮（D-06）
 *
 * Props：
 *   onSettings(anchor?)  — 透传给 ChatBubble → ErrorBubble 的 CTA 深链（D-12）
 *
 * 视觉系统见 styles.css。
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Trans } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useMessages, useChatStore, type Message } from '../store/chat';
import { useAgentStore, useCompletedRunIds, MAX_STEPS } from '../agent/agentStore';
import type { ToolResult } from '../agent/tools';
import ChatBubble from './ChatBubble';
import { AlertIcon, RetryIcon, ChevronDownIcon } from './icons';

// DiffLogPanel — lazy chunk（只在 run 完成后渲染，不进初始 main chunk，NFR-05）
const DiffLogPanel = lazy(() => import('./DiffLogPanel'));

interface ChatStreamProps {
  onSettings: (anchor?: string) => void;
}

// ---------------------------------------------------------------------------
// ExpandedBody — 折叠卡展开区（read 截断预览 / 错误提示 / JSON 兜底）
// ---------------------------------------------------------------------------

function ExpandedBody({ result }: { result: ToolResult | undefined }): ReactElement {
  const d = (result?.ok && typeof result.data === 'object' && result.data) as Record<string, unknown> | false;
  if (d && typeof d.content === 'string' && typeof d.source === 'string') {
    const c = d.content;
    const preview = c.slice(0, 500);
    const suffix = c.length > 500 ? `…(共 ${c.length} 字)` : '';
    return (
      <div className="wb-action-body">
        {d.source && <div className="aster-tool-card__source">{d.source as string}</div>}
        <div>{preview}{suffix}</div>
      </div>
    );
  }
  if (!result?.ok && result?.error) {
    return (
      <div className="wb-action-body">
        {result.error.message}{result.error.hint && <div>{result.error.hint}</div>}
      </div>
    );
  }
  return <pre className="wb-action-body">{JSON.stringify(result, null, 2)}</pre>;
}

// ---------------------------------------------------------------------------
// ToolResultCard — role='tool' 折叠卡 + soft-landing 特殊卡（Plan 06）
// ---------------------------------------------------------------------------

/**
 * ToolResultCard：渲染 role='tool' 消息。
 *
 * 分三条路径：
 * 1) soft-landing（toolName='soft-landing'）— 渲染两按钮卡片：
 *    - 「继续 20 步」 → useAgentStore.continueRun（reset step + 转 running）
 *    - 「停下」       → useAgentStore.abort('user')
 * 2) CIRCUIT_OPEN（toolResult.error.code='CIRCUIT_OPEN'）— 红卡（ERR-04）：
 *    - 套 err-bubble 视觉范式（D-06）
 *    - inset 3px 红色 stripe + CIRCUIT_OPEN 代号 + AlertIcon
 *    - 按钮：「重新试试」→ runAgent(原始 user prompt, selectionCtx, adapter)
 *    - 无撤销按钮（D-06 诚实禁用，undo 是 Phase 5）
 * 3) 常规 tool（append_paragraph 等）— 渲染折叠卡（D-05 wb-action-head 范式）：
 *    - ChevronDownIcon SVG 取代 ▸/▾ 字符
 *    - header 显示 message.content（humanLabel 中文人话）
 *    - 默认折叠；展开时 read tool 显示 source + content 截断预览，其他显示 toolResult JSON
 */
function ToolResultCard({ message }: { message: Message }): ReactElement {
  const adapter = useAdapter();
  const continueRun = useAgentStore((s) => s.continueRun);
  const abort = useAgentStore((s) => s.abort);
  // CR-02：lastCircuitInfo 用 Hook 订阅（非 getState() 快照），保证 store 更新后卡片重渲染
  const lastCircuitInfo = useAgentStore((s) => s.lastCircuitInfo);
  const [expanded, setExpanded] = useState(false);

  // soft-landing：MAX_STEPS 软着陆卡片（D-09）
  if (message.toolName === 'soft-landing') {
    return (
      <div className="aster-tool-card aster-tool-card--soft-landing">
        <div className="aster-tool-card__title">{message.content}</div>
        <div className="aster-tool-card__actions">
          <button
            type="button"
            className="aster-btn-primary aster-btn-primary--sm"
            onClick={() => continueRun()}
          >
            <Trans>继续 {MAX_STEPS} 步</Trans>
          </button>
          <button
            type="button"
            className="aster-tool-card__btn-secondary"
            onClick={() => abort('user')}
          >
            <Trans>停下</Trans>
          </button>
        </div>
      </div>
    );
  }

  // CIRCUIT_OPEN 红卡（ERR-04）— 套 err-bubble 视觉范式（D-06）
  if (message.toolResult?.error?.code === 'CIRCUIT_OPEN') {
    const rid = message.agentRunId;
    const msgs = useChatStore.getState().messages;
    const ci = lastCircuitInfo;
    // CR-02：rid 缺失时绝不按 agentRunId===undefined 去 find（会抓到无关 run 的消息/错 prompt）。
    //   rid 缺失 → suggestion/prompt 安全降级为空；prompt 为空时不渲染「重新试试」（避免重发空 prompt）。
    const suggestion = rid
      ? (msgs.filter((m) => m.role === 'assistant' && m.agentRunId === rid).at(-1)?.content ?? '')
      : '';
    const prompt = rid
      ? (msgs.find((m) => m.role === 'user' && m.agentRunId === rid)?.content ?? '')
      : '';
    const toolName = ci?.toolName ?? message.toolName ?? 'tool';
    const count = ci?.count ?? 3;
    return (
      <div className="msg msg-ai">
        <div className="err-bubble">
          <div className="head">
            <AlertIcon size={13} />
            <span className="code">CIRCUIT_OPEN</span>
            <span><Trans>Aster 试了几次都没成功</Trans></span>
          </div>
          <div className="reason">
            <Trans>试了 {count} 次 {toolName} 都失败了。</Trans>
            {suggestion && <span>{suggestion}</span>}
          </div>
          <div className="cta-row">
            {prompt && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => { void useAgentStore.getState().runAgent(prompt, undefined, adapter); }}
              >
                <RetryIcon size={12} /><Trans>重新试试</Trans>
              </button>
            )}
            {/* 无撤销按钮——D-06 诚实禁用，undo 是 Phase 5 */}
          </div>
        </div>
      </div>
    );
  }

  // 常规 role='tool' 折叠卡：humanLabel 走 message.content，toolResult 折叠展开（D-05）
  const showLabel = message.content || message.toolName || 'tool';
  const isError = message.toolResult?.ok === false;
  const cardClass = `aster-tool-card${isError ? ' aster-tool-card--error' : ''}${message.kind === 'read' ? ' aster-tool-card--read' : ''}`;

  return (
    <div className={cardClass}>
      <button
        type="button"
        className="wb-action-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={String(showLabel)}
      >
        <ChevronDownIcon
          size={11}
          className={expanded ? 'is-up' : ''}
        />
        <span className="wb-action-target">{showLabel}</span>
      </button>
      {expanded && <ExpandedBody result={message.toolResult} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 工具卡合并（≥2 连续常规 tool 卡 → 单张多动作卡，按 design 多动作 writeback 范式）
// ---------------------------------------------------------------------------

/**
 * 「常规」tool 消息 = 可合并的折叠卡。
 * 排除 soft-landing（决策卡）和 CIRCUIT_OPEN（终止红卡）——这两类是 full-width 特殊卡，
 * 各自独立渲染，并打断合并组。
 */
function isRegularTool(m: Message): boolean {
  return (
    m.role === 'tool' &&
    m.toolName !== 'soft-landing' &&
    m.toolResult?.error?.code !== 'CIRCUIT_OPEN'
  );
}

/**
 * MergedToolGroup — 把 ≥2 连续常规 tool 卡合并为一张多动作卡（design README §4c「多动作」范式）：
 * 一个 .tool-group 卡 = 「N 项操作」头 + N 行（每行 wb-action-head 独立展开到 ExpandedBody）。
 * 比 N 张独立卡少 N-1 圈边框/间距，视觉更紧凑。无「撤销全部」——read/in-flight 无可撤销内容，
 * undo 是 Phase 5（诚实禁用，不造假按钮）。
 */
function MergedToolGroup({ messages }: { messages: Message[] }): ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allRead = messages.every((m) => m.kind === 'read');
  const groupClass = `tool-group${allRead ? ' tool-group--read' : ''}`;

  return (
    <div className={groupClass}>
      <div className="tool-group__head">
        <span className="tool-group__count">
          <Trans>{messages.length} 项操作</Trans>
        </span>
      </div>
      <ul className="tool-group__list">
        {messages.map((m) => {
          const isOpen = expanded.has(m.id);
          const isErr = m.toolResult?.ok === false;
          const label = m.content || m.toolName || 'tool';
          return (
            <li key={m.id} className={isErr ? 'is-error' : undefined}>
              <button
                type="button"
                className="wb-action-head"
                onClick={() => toggle(m.id)}
                aria-expanded={isOpen}
                aria-label={String(label)}
              >
                <ChevronDownIcon size={11} className={isOpen ? 'is-up' : ''} />
                <span className="wb-action-target">{label}</span>
              </button>
              {isOpen && <ExpandedBody result={m.toolResult} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ChatStream({ onSettings }: ChatStreamProps): ReactElement {
  const adapter = useAdapter();
  const logo = `${import.meta.env.BASE_URL}assets/icon-80.png`;

  const messages = useMessages();
  const retryMessage = useChatStore((s) => s.retryMessage);
  const completedRunIds = useCompletedRunIds();
  const agentStatus = useAgentStore((s) => s.agentStatus);
  const currentRunId = useAgentStore((s) => s.currentRunId);
  // Phase 15：含图消息发送后、runAgent 启动前的 vision 分析窗口 → 显示「看图中…」指示
  const visionPreparing = useAgentStore((s) => s.visionPreparing);

  // G-03 粘底状态机
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const prevLengthRef = useRef(messages.length);

  /** 检测滚动容器是否「在底部」（8px 阈值，避免亚像素抖动）*/
  const isAtBottom = (el: HTMLElement): boolean =>
    el.scrollTop + el.clientHeight >= el.scrollHeight - 8;

  /** onScroll：用户主动滚动时更新 stickToBottom */
  const handleScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    setStickToBottom(isAtBottom(el));
  };

  /** 流式追加 / 新消息时滚到底（条件：新消息强制；否则仅 stickToBottom 时）*/
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isNewMessage = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (isNewMessage || stickToBottom) {
      // 新消息用 smooth（视觉舒服）；流式 delta 追加用 auto（瞬时跟随 token 速度）
      el.scrollTo({ top: el.scrollHeight, behavior: isNewMessage ? 'smooth' : 'auto' });
    }
    // 依赖 messages 整体引用：流式 delta 追加（content 变化）也会触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, stickToBottom]);

  // Phase 6 D-15/D-16：host-specific killer-scenario chips
  // （Hook 在所有早期 return 之前无条件调用，合规——IN-03：移除残留的 eslint-disable）
  const setDraftPrompt = useChatStore((s) => s.setDraftPrompt);

  // 无消息：teal 空态（D-15：host-specific chips 按宿主渲染）
  if (messages.length === 0) {
    // chips 定义：三宿主各 3 条（UI-SPEC §1 D-14 文案已锁定）
    const CHIPS: Record<string, Array<{ label: string; seed: string }>> = {
      ppt: [
        { label: '做 Q3 销售复盘 PPT', seed: '帮我做一份 Q3 销售复盘 PPT，给 leadership 看，重点华东' },
        { label: '给图加红色边框右移', seed: '把左下角那张图加红色边框，再往右移 10 px' },
        { label: '补一页总结', seed: '在最长的那页后面补一页总结要点' },
      ],
      excel: [
        { label: '清洗数据做图', seed: '帮我清洗这份数据、加公式、画个图，再给三句话洞察' },
        { label: '哪个产品卖得好', seed: '看看哪个产品卖得最好，做个对比图' },
        { label: '去除重复行', seed: '检查一下有没有重复行，帮我去掉' },
      ],
      word: [
        { label: '整篇润色', seed: '帮我把整篇文档润色一遍，口语改成正式书面' },
        { label: '改选中段', seed: '把我选中的这段改得更正式一点' },
        { label: '生成摘要', seed: '帮我生成一个文档摘要，三句话以内' },
      ],
    };
    const host = adapter.capabilities().host;
    const chips = CHIPS[host] ?? [];

    return (
      <div className="chat-scroll">
        <div className="empty">
          {/* logo pulse 动画：scale(1)↔scale(1.06) 4s ease-in-out infinite */}
          <div className="empty-mark">
            <img src={logo} alt="Aster" style={{ width: 32, height: 32 }} />
          </div>
          <h3><Trans>从你正在做的东西开始</Trans></h3>
          <p><Trans>选中文档里的内容，或挑一个下面的例子开始。</Trans></p>
          {/* D-15：host-specific chips；D-16：点击填充 InputBar（不自动 send） */}
          <div className="suggestions">
            {chips.map((chip) => (
              <button
                key={chip.seed}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDraftPrompt(chip.seed)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // UI-02：思考气泡——当前 run 有空 content streaming assistant 消息时显示
  const lastAssistantInRun = currentRunId
    ? [...messages].reverse().find(
        (m) => m.role === 'assistant' && m.agentRunId === currentRunId
      )
    : undefined;
  const showTyping =
    (agentStatus === 'running' || agentStatus === 'paused') &&
    lastAssistantInRun !== undefined &&
    lastAssistantInRun.isStreaming === true &&
    lastAssistantInRun.content.trim() === '';

  // 有消息：按 role 分发渲染。连续 ≥2 张常规 tool 卡自动合并为一张 MergedToolGroup
  // （≥2 阈值，按 design 多动作卡范式）；单张仍独立渲染。
  // user/assistant/error → ChatBubble；soft-landing / CIRCUIT_OPEN → ToolResultCard（独立，打断合并组）。

  // UI-03 D-10：预计算每个 completedRunId 的最后消息 index，用于边界插入 DiffLogPanel
  const completedRunSet = new Set(completedRunIds);
  const runLastIndex = new Map<string, number>();
  messages.forEach((m, i) => {
    if (m.agentRunId && completedRunSet.has(m.agentRunId)) {
      runLastIndex.set(m.agentRunId, i);
    }
  });
  const insertedRuns = new Set<string>();

  // UI-03：尝试在 msgIndex 处插入对应 runId 的 DiffLogPanel（去重守门）
  const tryInsertDiffLog = (rid: string | undefined, msgIndex: number): void => {
    if (!rid) return;
    if (runLastIndex.get(rid) === msgIndex && !insertedRuns.has(rid)) {
      insertedRuns.add(rid);
      nodes.push(
        <Suspense key={`dlp-${rid}`} fallback={null}>
          <DiffLogPanel runId={rid} />
        </Suspense>,
      );
    }
  };

  const nodes: ReactElement[] = [];
  let toolRun: Message[] = [];
  // 追踪 toolRun 中最后入队消息的 messages index（用于 Pitfall 3：run 最后一条是 regularTool）
  let toolRunLastIdx = -1;

  const flushToolRun = (): void => {
    if (toolRun.length === 0) return;
    const lastInRun = toolRun[toolRun.length - 1];
    if (toolRun.length >= 2) {
      nodes.push(<MergedToolGroup key={`group-${toolRun[0].id}`} messages={toolRun} />);
    } else {
      for (const tm of toolRun) nodes.push(<ToolResultCard key={tm.id} message={tm} />);
    }
    toolRun = [];
    // Pitfall 3（RESEARCH.md §UI-03）：run 最后一条消息是 regularTool 时，
    // 在 flush 后检查是否需要插入 DiffLogPanel
    tryInsertDiffLog(lastInRun.agentRunId, toolRunLastIdx);
    toolRunLastIdx = -1;
  };

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (isRegularTool(m)) {
      toolRun.push(m);
      toolRunLastIdx = i;
      continue;
    }
    flushToolRun();
    if (m.role === 'tool') {
      nodes.push(<ToolResultCard key={m.id} message={m} />);
    } else {
      nodes.push(
        <ChatBubble
          key={m.id}
          message={m}
          onRetry={() => void retryMessage(m.id, adapter)}
          onSettings={onSettings}
        />,
      );
    }
    // 非 tool 消息自身的 runId 边界检查
    tryInsertDiffLog(m.agentRunId, i);
  }
  flushToolRun();

  return (
    <div className="aster-messages" ref={scrollRef} onScroll={handleScroll}>
      {nodes}
      {/* UI-02：思考气泡——首 token 前空窗期占位（D-06/D-07）；
          Phase 15：vision 分析窗口（visionPreparing）复用同款气泡，aria-label 切「正在看图片」 */}
      {(showTyping || visionPreparing) && (
        <div className="msg msg-ai">
          <div
            className="bubble bubble-ai bubble-typing"
            aria-label={visionPreparing ? '正在看图片' : '正在思考'}
            role="status"
          >
            <span className="bubble-typing__dot" aria-hidden="true" />
            <span className="bubble-typing__dot" aria-hidden="true" />
            <span className="bubble-typing__dot" aria-hidden="true" />
          </div>
        </div>
      )}
      {/* UI-03 D-10：DiffLogPanel 已由 nodes 循环内边界插入算法（tryInsertDiffLog）
          在各 runId 最后消息之后逐一插入，不再统一渲染到底部 */}
    </div>
  );
}
