/**
 * src/components/ImagePreviewCard.tsx — 生图预览卡（Phase 16 IMG-03）
 *
 * 当 agent 生图工具返回 preview_pending:true 后，此卡片渲染在 tool 折叠卡下方：
 * - 预览图 + 模型临时切换下拉（D-04）
 * - 「确认插入」→ insertImage helper → adapter 插图 → appendOperation（DiffLog 可见/Undo 可撤）
 * - 「重新生成」→ 同 prompt 用选定 model 重 roll（D-05），独立 AbortController（D-08）
 * - 「取消」→ 丢弃 base64（内存释放），不进 operationLog
 *
 * 安全约束（NFR-09 + T-16-12）：
 * - base64 只在本组件本地 state 存活，onInserted/onCancelled 后由父组件清除
 * - base64 不写入任何 Zustand store 或 localStorage
 * - insertImage.ts 错误 message 用字面量（T-16-13）
 * - D-08：生图独立 AbortController（不用 agentStore.abort）
 */
import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useAdapter } from '../context/AdapterContext';
import { insertImage } from '../lib/insertImage';
import { AihubmixImageClient } from '../providers/aihubmix-image';
import { ProviderRegistry } from '../providers/registry';
import { KeyInvalidError } from '../errors';
import { IMAGE_GEN_MODELS } from '../providers/registry';
import type { PptAdapter } from '../adapters/PptAdapter';
import type { WordAdapter } from '../adapters/WordAdapter';
import type { ImageConfig } from '../providers/types';

export interface ImagePreviewCardProps {
  /** 裸 base64（无 data: 前缀，真机 spike 确认裸格式用于插入；data URL 用于 <img> 预览） */
  base64: string;
  mimeType: string;
  /** 原始 prompt（重新生成 D-05 用） */
  prompt: string;
  /** 当前生图 model ID（初始值；可在预览卡内临时切换，D-04） */
  modelId: string;
  /** 来自承载此预览的 tool-role message.agentRunId（B3：insertImage appendOperation 用） */
  runId: string;
  /** 'ppt' | 'word'（决定 insertImage host 参数） */
  host: 'ppt' | 'word';
  /** operationLog humanLabel */
  humanLabel: string;
  /** 插入成功回调（父组件清除预览态） */
  onInserted: () => void;
  /** 取消回调（清除 base64 内存态） */
  onCancelled: () => void;
  /** 重新生成成功回调（父组件替换预览图 base64） */
  onRegenerate: (newBase64: string, newMimeType: string, newModelId: string) => void;
}

type PreviewStatus = 'preview' | 'inserting' | 'regenerating';

export function ImagePreviewCard({
  base64,
  mimeType,
  prompt,
  modelId,
  runId,
  host,
  humanLabel,
  onInserted,
  onCancelled,
  onRegenerate,
}: ImagePreviewCardProps): ReactElement {
  const adapter = useAdapter();
  const [status, setStatus] = useState<PreviewStatus>('preview');
  const [selectedModelId, setSelectedModelId] = useState(modelId);
  const [error, setError] = useState<string | null>(null);
  // D-08：生图独立 AbortController（不用 agentStore.abort）
  const abortControllerRef = useRef<AbortController | null>(null);

  /** 确认插入（D-02 解耦：调 insertImage helper） */
  const handleInsert = async (): Promise<void> => {
    setStatus('inserting');
    setError(null);

    let result;
    if (host === 'ppt') {
      // PPT 需要 slideIndex；由 adapter 内部获取当前 slide index
      // PptAdapter.getActiveSlideIndex() 若存在则调用，否则 fallback 到 1
      const pptAdapter = adapter as PptAdapter;
      const slideIndex =
        typeof (pptAdapter as unknown as Record<string, unknown>).getActiveSlideIndex === 'function'
          ? await (pptAdapter as unknown as { getActiveSlideIndex: () => Promise<number> }).getActiveSlideIndex()
          : 1;
      result = await insertImage('ppt', pptAdapter, base64, mimeType, {
        slideIndex,
        runId,
        humanLabel,
      });
    } else {
      result = await insertImage('word', adapter as WordAdapter, base64, mimeType, {
        runId,
        humanLabel,
      });
    }

    if (result.ok) {
      onInserted();
    } else {
      setError(result.error?.message ?? '插入失败，请重试');
      setStatus('preview');
    }
  };

  /** 重新生成（D-05：同 prompt 重 roll；D-04：覆盖 model 为 selectedModelId） */
  const handleRegenerate = async (): Promise<void> => {
    abortControllerRef.current = new AbortController();
    setStatus('regenerating');
    setError(null);

    let config: ImageConfig;
    try {
      config = ProviderRegistry.resolve('image-gen', () => {
        throw new Error('unused');
      }) as ImageConfig;
      // D-04：覆盖 config.model 为预览卡内联选择的 model（临时，不持久化 PREF）
      config = { ...config, model: selectedModelId };
    } catch (err) {
      if (err instanceof KeyInvalidError) {
        setError('aihubmix Key 未配置，请在设置中填写 Key');
      } else {
        setError('生图配置解析失败');
      }
      setStatus('preview');
      return;
    }

    try {
      const imageResult = await new AihubmixImageClient().generate(prompt, config, {
        signal: abortControllerRef.current.signal,
      });
      onRegenerate(imageResult.base64, imageResult.mimeType, selectedModelId);
      // status 由父组件控制（传入新 base64 后父组件更新 props，本组件回到 preview 态）
      setStatus('preview');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户主动取消，不报错
        setStatus('preview');
        return;
      }
      setError('重新生成失败，请重试');
      setStatus('preview');
    }
  };

  /** 取消（含中断进行中的重新生成 fetch） */
  const handleCancel = (): void => {
    abortControllerRef.current?.abort();
    onCancelled();
  };

  return (
    <div className="aster-tool-card img-preview-card">
      {/* 生成中 loading 态（D-08） */}
      {status !== 'preview' && (
        <div className="aster-tool-card__generating">
          <span className="aster-tool-card__spinner" aria-hidden="true" />
          <span>{status === 'inserting' ? '正在插入…' : '正在重新生成…'}</span>
        </div>
      )}

      {/* 预览态 */}
      {status === 'preview' && (
        <>
          <img
            src={`data:${mimeType};base64,${base64}`}
            alt="生成图片预览"
            style={{
              maxWidth: '100%',
              borderRadius: 'var(--radius-2)',
              display: 'block',
            }}
          />

          {/* 模型临时切换下拉（D-04：预览卡内联，不持久化） */}
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="aster-settings__select"
            aria-label="切换生图模型"
            style={{ marginTop: 'var(--space-1)' }}
          >
            {IMAGE_GEN_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          {/* 错误提示 */}
          {error && (
            <p
              style={{
                color: 'var(--error)',
                fontSize: '12px',
                margin: 0,
                marginTop: 'var(--space-1)',
              }}
            >
              {error}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="aster-tool-card__actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCancel}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void handleRegenerate()}
            >
              重新生成
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleInsert()}
            >
              确认插入
            </button>
          </div>
        </>
      )}
    </div>
  );
}
