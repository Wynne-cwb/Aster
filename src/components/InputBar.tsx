/**
 * src/components/InputBar.tsx — 统一输入容器（Phase 04.1 teal 重皮 D-01/D-02）
 *
 * WeChat 范式：.inputbar-wrap > .inputbar > [selpill-row?] + textarea + .tools
 *
 * 结构：
 * - selpill-row（顶部）：条件渲染，有选区（ctx 非空）时显示 SelectionPill
 * - textarea：auto-grow，最大 140px，无边框透明
 * - tools 行（底部）：gear 左 | paperclip disabled 中 | spacer | send 右
 *
 * Phase 3 改造（Plan 05 D-01 / A-14）行为保留：
 * - sendMessage 签名扩展为 (prompt, selectionCtx, adapter) — chatStore thin delegate
 * - Send 按钮在 agentStatus !== 'idle' 时 disabled（防止串场 prompt）
 * - stop 走 AgentControlBar（D-04 / AGENT-13 单一 abort 入口）
 *
 * onGoSettings prop（D-01）：齿轮按钮点击回调，由 App.tsx 传入 handleOpenSettings
 */
import { useState, useEffect, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { ClipboardIcon, FileIcon, GearIcon, PaperclipIcon, SendIcon } from './icons';
import SelectionPill from './SelectionPill';
import { useChatStore } from '../store/chat';
import { useToastStore } from '../store/toast';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { useAgentStatus } from '../agent/agentStore';
import { useSelectionStore } from '../store/selection';
import { useAttachmentStore } from '../store/attachments';
import type { FileKind } from '../store/attachments';

interface InputBarProps {
  onGoSettings: () => void;
}

export default function InputBar({ onGoSettings }: InputBarProps): React.ReactElement {
  const { t } = useLingui();
  const adapter = useAdapter();

  // 输入框文本
  const [text, setText] = useState('');

  // Phase 6 D-16：chip 填充监听——draftPrompt 非空时填入 text + 清除 draft
  const draftPrompt = useChatStore((s) => s.draftPrompt);
  const clearDraftPrompt = useChatStore((s) => s.clearDraftPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draftPrompt) {
      setText(draftPrompt);
      clearDraftPrompt();
      // 填充后自动 focus textarea，提升 UX（用户可直接编辑/发送）
      textareaRef.current?.focus();
    }
  }, [draftPrompt, clearDraftPrompt]);

  // 复制调试信息按钮：成功后弹 toast（16-05）
  const showToast = useToastStore((s) => s.showToast);

  // 附件列表（内存态，不持久化）— Phase 17 演进：统一 image + document 附件
  const attachments = useAttachmentStore((s) => s.attachments);
  const removeAttachment = useAttachmentStore((s) => s.removeAttachment);

  // Plan 05 A-14：agentStatus !== 'idle' 时禁用发送（防串场 prompt）
  const agentStatus = useAgentStatus();
  const isAgentBusy = agentStatus !== 'idle';

  // Store action — sendMessage 改 thin delegate（Plan 05 D-01）
  const sendMessage = useChatStore((s) => s.sendMessage);

  // 选区状态：kind !== 'none' 时在顶部显示 selpill-row（条件渲染 D-02）
  const selectionInitial = useSelectionStore((s) => s.initial);
  const hasSelection = selectionInitial.kind !== 'none';

  /** 发送消息：构建 prompt + 可选选区上下文 */
  const handleSend = async (): Promise<void> => {
    const prompt = text.trim();
    if (!prompt || isAgentBusy) return;

    setText('');

    // G-08 D-34：读 attachEnabled，false → 不取选区
    const attachEnabled = useProviderStore.getState().attachEnabled;
    const sel = attachEnabled ? await adapter.getSelection() : undefined;
    // Plan 05 D-01：3 参签名，把 adapter 注入 chatStore.sendMessage → useAgentStore.runAgent
    await sendMessage(prompt, sel ?? undefined, adapter);
  };

  /** 复制调试信息到剪贴板，成功后弹 toast（16-05）。
   *  debugReport 懒加载（dynamic import）——调试工具非热路径，不进初始 bundle（守 size-limit 预算）。 */
  const handleCopyDebug = async (): Promise<void> => {
    const { buildDebugReport, copyToClipboard } = await import('../lib/debugReport');
    const report = await buildDebugReport();
    const ok = await copyToClipboard(report);
    if (ok) {
      showToast(t`已复制到剪贴板`);
    }
  };

  /** 按下 Enter 发送（Shift+Enter 换行） */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ---------------------------------------------------------------------------
  // Phase 15 FILE-06：图片上传（file input + Ctrl+V paste）
  // ---------------------------------------------------------------------------

  /** File → 裸 base64（去掉 data:...;base64, 前缀） */
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ---------------------------------------------------------------------------
  // Phase 17 FILE-01：processFiles 分流 image/document（D-11 eager 解析）
  // ---------------------------------------------------------------------------

  /** 文档 MIME → FileKind 映射 */
  const DOC_MIME_TO_KIND: Record<string, string> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'text',
    'text/markdown': 'text',
    'text/csv': 'text',
    'application/json': 'text',
  };

  /** 扩展名兜底（MIME 可能缺失） */
  const EXT_TO_KIND: Record<string, string> = {
    docx: 'docx', xlsx: 'xlsx', pdf: 'pdf', pptx: 'pptx',
    txt: 'text', md: 'text', csv: 'text', json: 'text',
  };

  const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  /** 5 MB per image 上限（RESEARCH §问题 2 推荐，防 vision quota DoS，T-15-10） */
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  /** ~20 MB 文档上限（D-04，防超大文件把浏览器解析卡死） */
  const MAX_DOC_SIZE = 20 * 1024 * 1024;

  /**
   * 将 File[] 按 MIME/扩展名分流 image / document 两路处理。
   * - image 路径：phase 15 既有，转 base64 加入 store
   * - document 路径：加入 store（状态 parsing）后立即 D-11 eager 解析
   * MIME 双重检查（file input accept + 此函数内 IMAGE_MIMES/DOC_MIME_TO_KIND，T-15-09）
   */
  const processFiles = async (files: File[]): Promise<void> => {
    for (const file of files) {
      if (IMAGE_MIMES.has(file.type)) {
        // 图片路径（Phase 15 既有）
        if (file.size > MAX_IMAGE_SIZE) {
          alert(t`图片过大，请选择 5MB 以下的图片`);
          continue;
        }
        const base64 = await fileToBase64(file);
        useAttachmentStore.getState().addAttachment({
          kind: 'image',
          id: crypto.randomUUID(),
          base64,
          mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
          fileName: file.name,
          sizeBytes: file.size,
        });
        continue;
      }

      // 文档路径
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const fileKind = DOC_MIME_TO_KIND[file.type] ?? EXT_TO_KIND[ext];
      if (!fileKind) {
        // D-14 不支持的文件类型
        alert(t`暂不支持该文件类型，当前支持 Word/Excel/PDF/PPT 及纯文本（txt/md/csv/json）`);
        continue;
      }
      if (file.size > MAX_DOC_SIZE) {
        // D-04 文件过大
        alert(t`文件过大，请选择 20MB 以下的文件`);
        continue;
      }

      // 加入 store（状态 parsing）
      const id = crypto.randomUUID();
      useAttachmentStore.getState().addAttachment({
        kind: 'document',
        id,
        fileName: file.name,
        sizeBytes: file.size,
        fileKind: fileKind as FileKind,
        status: 'parsing',
      });

      // D-11 eager 解析（选中即解析，不等发送）
      void (async () => {
        try {
          let text: string;
          if (fileKind === 'docx') {
            const { parseDocx } = await import('../lib/parsers/docx');
            text = await parseDocx(file);
          } else if (fileKind === 'xlsx') {
            const { parseXlsx } = await import('../lib/parsers/xlsx');
            text = await parseXlsx(file);
          } else if (fileKind === 'pdf') {
            const { parsePdf } = await import('../lib/parsers/pdf');
            text = await parsePdf(file);
          } else if (fileKind === 'pptx') {
            const { parsePptx } = await import('../lib/parsers/pptx');
            text = await parsePptx(file);
          } else {
            const { parseText } = await import('../lib/parsers/text');
            text = await parseText(file);
          }
          const truncated = text.endsWith('[注：文件内容过长，已读取前约 30 万字符]');
          useAttachmentStore.getState().updateAttachment(id, {
            status: 'ready',
            derivedText: text,
            truncated,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '无法解析此文件（可能已加密或损坏）';
          useAttachmentStore.getState().updateAttachment(id, {
            status: 'error',
            errorMessage: msg,
          });
        }
      })();
    }
  };

  /** file input onChange 处理（支持 multiple） */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    void processFiles(files);
    e.target.value = ''; // 允许重复选同一文件
  };

  /**
   * Ctrl+V 粘贴处理（图片 + 文档均支持）。
   * 使用同步 DataTransfer API（clipboardData.items），不用 navigator.clipboard。
   * 同步 DataTransfer 不受 Office for Web iframe Permissions Policy 限制（RESEARCH §问题 2 / Pitfall 4）。
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const fileItems = items.filter((i) => i.kind === 'file');
    if (!fileItems.length) return;
    e.preventDefault();
    const files = fileItems
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    void processFiles(files);
  };

  return (
    <div className="inputbar-wrap">
      <div className="inputbar">

        {/* selpill-row：有选区时条件渲染（D-02 — 选区信息从 ContextCard 迁入此处） */}
        {hasSelection && (
          <div className="selpill-row">
            <SelectionPill />
          </div>
        )}

        {/* Phase 17 FILE-01/12：附件 chip 行（D-12「仅供 AI 阅读」标注 + 统一 image/document）*/}
        {attachments.length > 0 && (
          <div className="attachment-chips">
            {attachments.map((att) => (
              <div key={att.id} className="attachment-chip">
                {att.kind === 'image' && (
                  <img
                    src={`data:${att.mimeType};base64,${att.base64}`}
                    alt={att.fileName}
                    className="attachment-chip-thumb"
                  />
                )}
                {att.kind === 'document' && (
                  <span className="attachment-chip-icon">
                    <FileIcon size={14} />
                  </span>
                )}
                <span className="attachment-chip-name">
                  {att.fileName}
                  {att.kind === 'document' && att.status === 'parsing' && t` (解析中…)`}
                  {att.kind === 'document' && att.status === 'error' && t` (解析失败)`}
                </span>
                {/* D-12：「仅供 AI 阅读」标注（图片+文档统一显示）*/}
                <span className="attachment-chip-label">{t`仅供 AI 阅读`}</span>
                <button
                  type="button"
                  className="attachment-chip-remove"
                  aria-label={t`移除附件`}
                  onClick={() => removeAttachment(att.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* textarea：auto-grow，最大 140px */}
        <textarea
          ref={textareaRef}
          className="chat-input"
          rows={2}
          placeholder={isAgentBusy ? t`AI 正在回答…` : t`输入消息…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isAgentBusy}
          aria-label={t`消息输入框`}
        />

        {/* tools row：gear 左 | paperclip disabled 中 | spacer | send 右 */}
        <div className="tools">
          <button
            type="button"
            className="tool-btn"
            aria-label={t`设置`}
            onClick={() => onGoSettings()}
          >
            <GearIcon size={15} strokeWidth={1.4} />
          </button>
          <button
            type="button"
            className="tool-btn"
            aria-label={t`复制调试信息`}
            title={t`复制调试信息`}
            onClick={() => void handleCopyDebug()}
          >
            <ClipboardIcon size={15} strokeWidth={1.4} />
          </button>
          {/* Phase 17 FILE-01：回形针入口文案改「参考文件」，accept 扩展到文档类型（D-08）*/}
          <button
            type="button"
            className="tool-btn"
            aria-label={t`参考文件`}
            title={t`参考文件`}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon size={15} />
          </button>
          {/* 隐藏 file input：图片 + 文档类型（Phase 17 扩展）*/}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.docx,.xlsx,.pdf,.pptx,.txt,.md,.csv,.json"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <span className="tools-spacer" />
          {/* CR-03 诚实方案：agent 运行时发送键保持 disabled，但仍显示「发送」图标 + aria，
              不冒充「停止」（点击无 abort 行为，会欺骗用户）。停止入口交给 AgentControlBar。 */}
          <button
            type="button"
            className="send-btn"
            disabled={isAgentBusy || !text.trim()}
            onClick={() => void handleSend()}
            aria-label={t`发送`}
          >
            <SendIcon size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
