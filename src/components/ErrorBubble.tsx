/**
 * src/components/ErrorBubble.tsx — 错误气泡（D-10 / D-11 / D-12 / D-13 / PROV-08）
 *
 * Phase 04.1 重皮（Wave 3，D-06）：
 * - err-bubble 新形态：左 3px inset stripe（box-shadow: inset 3px 0 0 var(--error)）
 * - .head：AlertIcon 13px + .code mono 代号 + 红色 fw600 文字
 * - .reason：主文案（固定 UI_MAP 字符串，非 message prop，安全约束保留）
 * - .cta：下划线点击链接（设置深链 / 重试操作）
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
  UNSUPPORTED: {
    reason: '当前模型不支持 tool calling',
    cta: '前往设置更换模型 →',
    ctaType: 'settings',
    anchor: 'model-input',
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
    <div className="msg msg-ai">
      <div className="err-bubble">
        {/* head：AlertIcon 13px + .code mono 代号 */}
        <div className="head">
          <AlertIcon size={13} />
          <span className="code">{errorCode}</span>
        </div>

        {/* reason：主错误文案（固定 UI_MAP 字符串，不暴露 message prop） */}
        <div className="reason">{ui.reason}</div>

        {/* CTA 行 */}
        {ui.ctaType !== 'none' && (
          <div className="cta-row">
            {ui.ctaType === 'settings' && (
              <span
                className="cta"
                role="button"
                tabIndex={0}
                onClick={() => onSettings(ui.anchor)}
                onKeyDown={(e) => e.key === 'Enter' && onSettings(ui.anchor)}
                aria-label={t`前往设置`}
              >
                {ui.cta}
              </span>
            )}

            {ui.ctaType === 'action' && retryPrompt != null && (
              <span
                className="cta"
                role="button"
                tabIndex={0}
                onClick={onRetry}
                onKeyDown={(e) => e.key === 'Enter' && onRetry()}
                aria-label={t`重试`}
              >
                <RetryIcon size={12} />
                {ui.cta}
              </span>
            )}

            {ui.ctaType === 'action' && retryPrompt == null && (
              <span className="cta-hint">{ui.cta}</span>
            )}

            {/* 若有 retryPrompt 且 ctaType='settings'：额外「重试」按钮 */}
            {ui.ctaType === 'settings' && retryPrompt != null && (
              <span
                className="cta"
                role="button"
                tabIndex={0}
                onClick={onRetry}
                onKeyDown={(e) => e.key === 'Enter' && onRetry()}
                aria-label={t`重试`}
              >
                <RetryIcon size={12} />
                <Trans>重试</Trans>
              </span>
            )}
          </div>
        )}

        {ui.ctaType === 'none' && (
          <div className="cta-hint">{ui.cta}</div>
        )}
      </div>
    </div>
  );
}
