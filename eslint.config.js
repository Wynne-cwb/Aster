import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // TypeScript 文件规则
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // 禁用 legacy DeepSeek 模型名（2026-07-24 退役）— PROV-10
      // 使用 no-restricted-syntax 匹配字符串字面量
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/deepseek-chat|deepseek-reasoner/]",
          message:
            'legacy 模型名已废弃（2026-07-24 退役），请使用 deepseek-v4-flash 或 deepseek-v4-pro',
        },
      ],

      // 禁用 LLM SDK 包导入（无后台约束，使用原生 fetch）— PROV-10
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['openai', 'openai/*'],
              message: '禁止引入 openai SDK，Aster 使用原生 fetch（无后台约束）',
            },
            {
              group: ['@anthropic-ai/*'],
              message: '禁止引入 Anthropic SDK，Aster 使用原生 fetch（无后台约束）',
            },
            {
              group: ['ai', 'ai/*', '@ai-sdk/*'],
              message: '禁止引入 Vercel AI SDK，Aster 使用原生 fetch（无后台约束）',
            },
          ],
        },
      ],
    },
  },
];
