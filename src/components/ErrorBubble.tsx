/**
 * src/components/ErrorBubble.tsx — 错误气泡（D-10 / D-11 / D-12 / D-13 / PROV-08）
 *
 * 8 类错误均有明确中文 CTA 文案（D-13 锁定）。
 * ctaType='settings'：深链到 Settings 对应字段（D-12，onSettings(anchor) 回调）
 * ctaType='action'：操作型 CTA（重试、充值等）
 * ctaType='none'：纯文字提示，无可操作按钮
 *
 * 安全约束（T-02-22 / T-01-04）：
 * - 仅展示 ERROR_UI_MAP[errorCode].reason（固定字符串），不展示 message prop 内容
 * - message prop 仅用于调试，不渲染到 UI（防止 API Key 泄漏）
 *
 * 所有字符串用 Lingui 包裹（zh-CN catalog 提取）。
 */
import type { ReactElement } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { AlertIcon, RetryIcon } from './icons';

// ---------------------------------------------------------------------------
// 8 类错误 CTA 映射表（D-13 锁定文案，PROV-08）
// ---------------------------------------------------------------------------

interface ErrorUI {
  reason: string;
  cta: string;
  ctaType: 'settings' | 'action' | 'none';
  anchor?: string;
}

const ERROR_UI_MAP: Record<string, ErrorUI> = {
  KEY_INVALID: {
    reason: 'API Key 无效',
    cta: '前往设置更新 Key →',
    ctaType: 'settings',
    anchor: 'key-input',
  },
  QUOTA: {
    reason: '账户余额不足',
    cta: '前往充值 →',
    ctaType: 'action',
    anchor: undefined,
  },
  RATE_LIMIT: {
    reason: '请求过快，已自动重试',
    cta: '重试',
    ctaType: 'action',
    anchor: undefined,
  },
  CONTEXT: {
    reason: '内容过长',
    cta: '减少选区或切换更大模型',
    ctaType: 'none',
    anchor: undefined,
  },
  NETWORK: {
    reason: '网络连接失败',
    cta: '重试',
    ctaType: 'action',
    anchor: undefined,
  },
  FILTER: {
    reason: '内容被过滤',
    cta: '修改输入后重试',
    ctaType: 'action',
    anchor: undefined,
  },
  MODEL: {
    reason: '模型不存在',
    cta: '前往设置检查模型名称 →',
    ctaType: 'settings',
    anchor: 'model-input',
  },
  IMAGE_QUOTA: {
    reason: '图像生成配额用尽',
    cta: '前往 aihubmix 充值 →',
    ctaType: 'action',
    anchor: undefined,
  },
};

const DEFAULT_UI: ErrorUI = {
  reason: '请求失败',
  cta: '重试',
  ctaType: 'action',
};

// ---------------------------------------------------------------------------
// ErrorBubble 组件
// ---------------------------------------------------------------------------

interface ErrorBubbleProps {
  /** AsterError.code 值（'KEY_INVALID' 等），用于查映射表 */
  errorCode: string;
  /** 技术原因（不对用户展示，安全约束 T-02-22 / T-01-04） */
  message: string;
  /** D-11：重试按钮点击后用此 prompt 重发 */
  retryPrompt?: string;
  /** 点击重试按钮的回调 */
  onRetry: () => void;
  /** D-12：深链打开设置（anchor = 字段 ID） */
  onSettings: (anchor?: string) => void;
}

export default function ErrorBubble({
  errorCode,
  // message is intentionally unused in UI — security constraint T-02-22 / T-01-04
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  message: _message,
  retryPrompt,
  onRetry,
  onSettings,
}: ErrorBubbleProps): ReactElement {
  const { t } = useLingui();

  const ui = ERROR_UI_MAP[errorCode] ?? DEFAULT_UI;

  return (
    <div className="aster-error-bubble">
      {/* 图标行：AlertIcon + 错误原因 */}
      <div className="aster-error-bubble__icon-row">
        <AlertIcon />
        <span>{ui.reason}</span>
      </div>

      {/* CTA 行 */}
      <div className="aster-error-bubble__cta-row">
        {ui.ctaType === 'settings' && (
          <button
            className="aster-error-bubble__cta"
            onClick={() => onSettings(ui.anchor)}
            aria-label={t`前往设置`}
          >
            {ui.cta}
          </button>
        )}

        {ui.ctaType === 'action' && retryPrompt != null && (
          <button
            className="aster-error-bubble__cta"
            onClick={onRetry}
            aria-label={t`重试`}
          >
            <RetryIcon />
            {ui.cta}
          </button>
        )}

        {ui.ctaType === 'action' && retryPrompt == null && (
          <span className="aster-error-bubble__hint">{ui.cta}</span>
        )}

        {ui.ctaType === 'none' && (
          <span className="aster-error-bubble__hint">{ui.cta}</span>
        )}

        {/* 若有 retryPrompt 且 ctaType='settings'：额外「重试」按钮 */}
        {ui.ctaType === 'settings' && retryPrompt != null && (
          <button
            className="aster-error-bubble__cta"
            onClick={onRetry}
            aria-label={t`重试`}
          >
            <RetryIcon />
            <Trans>重试</Trans>
          </button>
        )}
      </div>
    </div>
  );
}
