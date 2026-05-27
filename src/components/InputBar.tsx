/**
 * src/components/InputBar.tsx — 玻璃拟态输入栏（全禁用占位，D-07/D-08）
 *
 * 单行布局：[上传] [输入框] [发送]。
 * Provider 不在此处切换 —— 它是设置项（顶部齿轮入口，目前仅 AiHubMix / DeepSeek），
 * 不在输入栏暴露显眼切换控件（用户 2026-05-27 反馈）。
 *
 * Phase 1 所有控件禁用，靠降低不透明度 + not-allowed 光标诚实表达「还没开」而非「坏了」：
 *   - 上传按钮（icon）：disabled，title「文件上传即将开放」
 *   - 输入框：disabled，placeholder「输入消息…」
 *   - 发送按钮：disabled，保留品牌渐变色槽（UI-SPEC Color accent ①）
 *
 * 文案全 Lingui macro 包裹。视觉系统见 styles.css。
 */
import { useLingui } from '@lingui/react/macro';
import { UploadIcon, SendIcon } from './icons';

export default function InputBar(): React.ReactElement {
  const { t } = useLingui();

  return (
    <div className="aster-inputbar">
      <div className="aster-inputbar__field-row">
        {/* 上传按钮（禁用，即将开放） */}
        <button
          className="aster-iconbtn aster-iconbtn--ghost"
          disabled
          aria-label={t`文件上传即将开放`}
          title={t`文件上传即将开放`}
        >
          <UploadIcon />
        </button>

        {/* 输入框（禁用，Phase 2 接入时启用） */}
        <textarea
          className="aster-field"
          disabled
          rows={2}
          placeholder={t`输入消息…`}
        />

        {/* 发送按钮（禁用，保留品牌渐变色槽） */}
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
  );
}
