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
import { ClipboardIcon, GearIcon, PaperclipIcon, SendIcon } from './icons';
import SelectionPill from './SelectionPill';
import { useChatStore } from '../store/chat';
import { useToastStore } from '../store/toast';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { useAgentStatus } from '../agent/agentStore';
import { useSelectionStore } from '../store/selection';
import { useAttachmentStore } from '../store/attachments';
import type { AttachedImage } from '../store/attachments';

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

  // 附件图列表（内存态，不持久化）
  const attachedImages = useAttachmentStore((s) => s.images);
  const removeImage = useAttachmentStore((s) => s.removeImage);

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

  /** 5 MB per image 上限（RESEARCH §问题 2 推荐，防 vision quota DoS，T-15-10） */
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

  /**
   * 将 File[] 转换成 AttachedImage[] 并追加进 store。
   * MIME 双重检查（file input accept + 此函数内 validMimes，T-15-09）。
   * 大图 > 5MB 诚实提示拒绝（T-15-10）。
   * 非图片文件诚实提示「文件解析即将开放」（D-11/D-14）。
   */
  const processImageFiles = async (files: File[]): Promise<void> => {
    const validMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    const results: AttachedImage[] = [];
    for (const file of files) {
      if (!validMimes.has(file.type)) {
        // D-14 诚实：非图片文件告知 Phase 17 再支持
        alert(t`文件解析即将开放，当前可上传图片（png/jpg/webp）`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        alert(t`图片过大，请选择 5MB 以下的图片`);
        continue;
      }
      const base64 = await fileToBase64(file);
      results.push({
        id: crypto.randomUUID(),
        base64,
        mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        fileName: file.name,
        sizeBytes: file.size,
      });
    }
    if (results.length > 0) {
      useAttachmentStore.getState().addImages(results);
    }
  };

  /** file input onChange 处理（支持 multiple） */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    void processImageFiles(files);
    e.target.value = ''; // 允许重复选同一文件
  };

  /**
   * Ctrl+V 粘贴图片处理。
   * 使用同步 DataTransfer API（clipboardData.items），不用 navigator.clipboard。
   * 同步 DataTransfer 不受 Office for Web iframe Permissions Policy 限制（RESEARCH §问题 2 / Pitfall 4）。
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageItems = items.filter(
      (i) => i.kind === 'file' && i.type.startsWith('image/'),
    );
    if (!imageItems.length) return;
    // 有图片：阻止文字粘贴路径（图片不需要文字 fallback）
    e.preventDefault();
    const files = imageItems
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    void processImageFiles(files);
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

        {/* Phase 15 FILE-06：上传图缩略图 chip 行（D-10 多轮复用 UI）*/}
        {attachedImages.length > 0 && (
          <div className="attachment-chips">
            {attachedImages.map((img) => (
              <div key={img.id} className="attachment-chip">
                <img
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={img.fileName}
                  className="attachment-chip-thumb"
                />
                <span className="attachment-chip-name">{img.fileName}</span>
                <button
                  type="button"
                  className="attachment-chip-remove"
                  aria-label={t`移除图片`}
                  onClick={() => removeImage(img.id)}
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
          {/* Phase 15 FILE-06：回形针激活（D-08）——从 aria-disabled 变为可点击，接 file input */}
          <button
            type="button"
            className="tool-btn"
            aria-label={t`上传图片`}
            title={t`上传图片`}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon size={15} />
          </button>
          {/* 隐藏 file input，仅接受图片（phase 15 只接图，D-11） */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
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
