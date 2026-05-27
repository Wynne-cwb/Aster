/**
 * src/components/InputBar.tsx — 玻璃拟态输入栏（全禁用占位，D-07/D-08）
 *
 * 统一输入容器（参考 WeChat / ChatGPT 范式）：一个圆角容器内，
 * 上方是无边框透明输入框，下方一条工具行——工具靠左下、发送靠右下，
 * 三者高度天然一致，不再平级参差。
 *
 * Provider 不在此处切换 —— 它是设置项（顶部齿轮入口，目前仅 AiHubMix / DeepSeek）。
 *
 * Phase 1 所有控件禁用，靠降低不透明度 + not-allowed 光标诚实表达「还没开」而非「坏了」。
 * 文案全 Lingui macro 包裹。视觉系统见 styles.css。
 */
import { useLingui } from '@lingui/react/macro';
import { UploadIcon, SendIcon } from './icons';

export default function InputBar(): React.ReactElement {
  const { t } = useLingui();

  return (
    <div className="aster-inputbar">
      <div className="aster-composer">
        {/* 输入框（无边框透明，禁用，Phase 2 接入时启用） */}
        <textarea
          className="aster-field"
          disabled
          rows={2}
          placeholder={t`输入消息…`}
        />

        {/* 工具行：上传（左）· 发送（右） */}
        <div className="aster-composer__toolbar">
          <button
            className="aster-iconbtn"
            disabled
            aria-label={t`文件上传即将开放`}
            title={t`文件上传即将开放`}
          >
            <UploadIcon />
          </button>
          <button
            className="aster-send"
            disabled
            aria-label={t`发送`}
            title={t`发送`}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
