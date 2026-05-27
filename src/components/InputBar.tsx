/**
 * src/components/InputBar.tsx — 玻璃拟态输入栏（全禁用占位，D-07/D-08）
 *
 * Phase 1 所有控件禁用，诚实表达能力边界（D-08）——靠降低不透明度 + not-allowed 光标，
 * 读起来像「还没开」而非「坏了」：
 *   - Provider 选择：disabled，文案「Provider（即将开放）」
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
      {/* 第一行：Provider 选择 + 上传 */}
      <div className="aster-inputbar__row">
        {/* Provider 占位（禁用，即将开放） */}
        <span className="aster-provider" aria-disabled="true">
          {t`Provider（即将开放）`}
        </span>

        {/* 上传按钮（禁用） */}
        <button
          className="aster-iconbtn aster-iconbtn--ghost"
          disabled
          aria-label={t`文件上传即将开放`}
          title={t`文件上传即将开放`}
        >
          <UploadIcon />
        </button>
      </div>

      {/* 第二行：输入框 + 发送 */}
      <div className="aster-inputbar__field-row">
        <textarea
          className="aster-field"
          disabled
          rows={2}
          placeholder={t`输入消息…`}
        />
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
