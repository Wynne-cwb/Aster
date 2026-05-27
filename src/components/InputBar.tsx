/**
 * src/components/InputBar.tsx — 底部输入栏（全禁用占位，D-07/D-08）
 *
 * Phase 1 所有控件禁用，诚实表达能力边界（D-08）：
 * - Provider Dropdown：disabled，placeholder「Provider（即将开放）」
 * - 上传 Button（icon）：disabled，Tooltip「文件上传即将开放」
 * - Textarea：disabled，placeholder「输入消息…」
 * - 发送 Button：disabled，appearance="primary"（保留品牌色槽，UI-SPEC Color accent ①）
 *
 * 文案全 Lingui macro 包裹（Shared Pattern 6）。
 * spacing 用 Fluent v9 token（Shared Pattern 7）。
 * Fluent v9 具体 import（Shared Pattern 4）。
 */
import {
  Button,
  Dropdown,
  Option,
  Textarea,
  Tooltip,
  tokens,
} from '@fluentui/react-components';
import { ArrowUploadRegular } from '@fluentui/react-icons';
import { Trans, useLingui } from '@lingui/react/macro';

export default function InputBar(): React.ReactElement {
  const { t } = useLingui();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
      }}
    >
      {/* 第一行：Provider 下拉 + 上传图标 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacingHorizontalS,
        }}
      >
        {/* Provider 下拉（禁用，即将开放）*/}
        <Dropdown
          disabled
          placeholder={t`Provider（即将开放）`}
          style={{ flex: 1, minWidth: 0 }}
        >
          {/* Phase 1 无选项，Phase 2 接入后填充 */}
          <Option disabled value="">
            {t`暂无 Provider`}
          </Option>
        </Dropdown>

        {/* 上传图标按钮（禁用，tooltip 提示即将开放）*/}
        <Tooltip
          content={t`文件上传即将开放`}
          relationship="label"
        >
          <Button
            icon={<ArrowUploadRegular />}
            appearance="subtle"
            disabled
            aria-label={t`文件上传即将开放`}
          />
        </Tooltip>
      </div>

      {/* 第二行：消息输入框 + 发送按钮 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: tokens.spacingHorizontalS,
        }}
      >
        {/* 消息输入框（禁用，Phase 2 接入时启用）*/}
        <Textarea
          disabled
          placeholder={t`输入消息…`}
          style={{ flex: 1, minWidth: 0, resize: 'none' }}
          rows={2}
        />

        {/* 发送按钮（禁用，保留 primary 品牌色槽，UI-SPEC Color accent ①）*/}
        <Button appearance="primary" disabled>
          <Trans>发送</Trans>
        </Button>
      </div>
    </div>
  );
}
