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
 *   - soft-landing（toolName='soft-landing'）：特殊卡片，两按钮「继续 20 步」/「停下」，
 *     分别调 useAgentStore.continueRun / abort('user')。loop.ts hit MAX_STEPS=20 时 push
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
import { useAgentStore, useCompletedRunIds } from '../agent/agentStore';
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
  const [expanded, setExpanded] = useState(false);

  // soft-landing：MAX_STEPS=20 软着陆卡片（D-09）
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
            <Trans>继续 20 步</Trans>
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
    const store = useAgentStore.getState();
    const msgs = useChatStore.getState().messages;
    const rid = message.agentRunId;
    const ci = store.lastCircuitInfo;
    const suggestion = msgs.filter((m) => m.role === 'assistant' && m.agentRunId === rid).at(-1)?.content ?? '';
    const prompt = msgs.find((m) => m.role === 'user' && m.agentRunId === rid)?.content ?? '';
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { void store.runAgent(prompt, undefined, adapter); }}
            >
              <RetryIcon size={12} /><Trans>重新试试</Trans>
            </button>
            {/* 无撤销按钮——D-06 诚实禁用，undo 是 Phase 5 */}
          </div>
        </div>
      </div>
    );
  }

  // 常规 role='tool' 折叠卡：humanLabel 走 message.content，toolResult 折叠展开（D-05）
  const showLabel = message.content || message.toolName || 'tool';
  const isError = message.toolResult?.ok === false;
  const cardClass = `aster-tool-card${isError ? ' aster-tool-card--error' : ''}`;

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

  return (
    <div className="tool-group">
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

  // 无消息：teal 空态（D-03：不渲染 suggestion chips，等 Phase 6）
  if (messages.length === 0) {
    return (
      <div className="chat-scroll">
        <div className="empty">
          {/* logo pulse 动画：scale(1)↔scale(1.06) 4s ease-in-out infinite */}
          <div className="empty-mark">
            <img src={logo} alt="Aster" style={{ width: 32, height: 32 }} />
          </div>
          <h3><Trans>从你正在做的东西开始</Trans></h3>
          <p><Trans>选中文档里的内容，告诉 Aster 你想做什么。</Trans></p>
          {/* D-03：不渲染 suggestion chips，等 Phase 6 */}
        </div>
      </div>
    );
  }

  // 有消息：按 role 分发渲染。连续 ≥2 张常规 tool 卡自动合并为一张 MergedToolGroup
  // （≥2 阈值，按 design 多动作卡范式）；单张仍独立渲染。
  // user/assistant/error → ChatBubble；soft-landing / CIRCUIT_OPEN → ToolResultCard（独立，打断合并组）。
  const nodes: ReactElement[] = [];
  let toolRun: Message[] = [];
  const flushToolRun = (): void => {
    if (toolRun.length === 0) return;
    if (toolRun.length >= 2) {
      nodes.push(<MergedToolGroup key={`group-${toolRun[0].id}`} messages={toolRun} />);
    } else {
      for (const tm of toolRun) nodes.push(<ToolResultCard key={tm.id} message={tm} />);
    }
    toolRun = [];
  };
  for (const m of messages) {
    if (isRegularTool(m)) {
      toolRun.push(m);
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
  }
  flushToolRun();

  return (
    <div className="aster-messages" ref={scrollRef} onScroll={handleScroll}>
      {nodes}
      {/* D-02：run 完成后，逐个 runId 渲染 DiffLogPanel（lazy chunk，只有写操作 > 0 的 run 才显示）
          DiffLogPanel 内部判断写操作数量，自行返回 null（无外部 length 检查）*/}
      {completedRunIds.map((runId) => (
        <Suspense key={runId} fallback={null}>
          <DiffLogPanel runId={runId} />
        </Suspense>
      ))}
    </div>
  );
}
