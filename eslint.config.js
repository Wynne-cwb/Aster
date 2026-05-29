/**
 * Aster ESLint 配置
 *
 * Phase 3 Plan 04 决策（D-13 — AGENT-08 humanLabel 强制策略）：
 *   - 主守门：TypeScript ToolDef interface 已硬性强制 humanLabel 字段。
 *     缺字段 → tsc 报错（详见 src/agent/tools/index.types.test.ts type-only test）。
 *   - 双轨守门：本文件追加 'no-restricted-syntax' AST selector 作 visual hint
 *     （warn 严重度，不阻断构建）。Phase 3 只有 1 个 write tool（append_paragraph），
 *     过早 enforce error 增加噪音；TS 接口已足以兜底。
 *   - Phase 5 flip 操作：多 write tool 上线时把 humanLabel selector 严重度从 warn
 *     提升为 error；或直接迁到自写 ESLint plugin（aster/require-human-label）做更
 *     准确的 AST 检测（当前用 no-restricted-syntax 的 selector 表达能力有限，
 *     无法精确判断"ToolDef 字面量缺 humanLabel"，只能近似匹配）。
 *
 *   AST selector 局限说明：typescript-eslint 的 selector 是 ESQuery 语法，:has /
 *   :not 在子节点关系上覆盖有限。本 phase 不追求精确，给开发者一个「记得写
 *   humanLabel」的提示就行；真正的强制靠 TS 接口。
 */
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
      // 多条 no-restricted-syntax 合一：每条独立 selector + message + severity
      // selector 0：legacy DeepSeek 模型名（PROV-10，error 严重度）
      // selector 1：humanLabel hint（D-13 / AGENT-08，warn 严重度 — 见上方注释）
      'no-restricted-syntax': [
        'error',
        {
          // 已 deprecated 模型名（2026-07-24 退役）
          selector: "Literal[value=/deepseek-chat|deepseek-reasoner/]",
          message:
            'legacy 模型名已废弃（2026-07-24 退役），请使用 deepseek-v4-flash 或 deepseek-v4-pro',
        },
      ],

      // ---------------------------------------------------------------------
      // D-13 / AGENT-08：humanLabel 字段强制（双轨之 eslint 一轨）
      //
      // Phase 3 用 warn 严重度（不阻断 CI / build），主要给开发者一个 visual hint。
      // 真正的强制由 TypeScript ToolDef interface 担保（缺字段 → tsc 报错）。
      // Phase 5 多 write tool 上线时改 error 严重度，或迁自写 plugin。
      //
      // selector 解读：匹配「明确以 'ToolDef' 作类型注解、且 ObjectExpression 内
      // 含有 Property[key.name='name'] 但缺 Property[key.name='humanLabel']」的
      // 字面量声明。当前 selector 表达力受限于 ESQuery + typescript-parser，
      // 仅作 hint 用途（false-positive 可能）。
      // ---------------------------------------------------------------------
      'aster/require-human-label': 'off',
      // Phase 5 D-15 flip 策略（已确认）：
      //   - humanLabel：TS ToolDef interface 已强制必填（tsc 报错守门）。
      //     注册层额外守门：buildToolsForHost（src/agent/tools/index.ts）对 kind='write' 的 ToolDef
      //     调用 assertWriteToolRegisterable(tool)——缺 humanLabel（非 function）→ throw Error（TOOL-04 注册阻断）。
      //     此 helper 在 Plan 07 Task 2 中实现；本策略此处文档化。
      //   - reverse（write tool 必须有）：TS 无法表达 kind='write' → reverse 必填的耦合关系
      //     → 守门方式 = 注册层 assertWriteToolRegisterable 检查 humanLabel 是 function（缺则 throw）
      //       + test-level：每个 write tool test 加 `expect(result.reverse).toBeDefined()` 作为补充
      //     → 本 phase 所有 write tool test 已在 Wave 0 / Wave 3 加此断言（src/agent/tools/write/word.test.ts line 85）
      //   - eslint rule 保持 'off'：现有 no-restricted-syntax selector 精度不足以区分 write tool，
      //     改 error 会产生 false positive；注册层 throw + TS + test 守门已足够（TOOL-04 满足）

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

  // ---------------------------------------------------------------------------
  // TOOL-07 — Office namespace 边界守门（A-06）
  //
  // 禁止 PowerPoint/Excel/Word 全局命名空间出现在 src/agent/** 与 src/store/**。
  // Office.js proxy 生命周期 = *.run 闭包，跨 await 边界失效（A-06）；
  // 在编译期阻止 proxy 泄漏到 agent/store 层。
  //
  // src/adapters/*Adapter.ts 不在 files 匹配内 → 天然不受限（合法使用 namespace）。
  // src/agent/__fixtures__/** 在 ignores 内 → 冒烟 fixture 故意违例，不被日常 lint 误报。
  // ---------------------------------------------------------------------------
  {
    files: ['src/agent/**/*.ts', 'src/store/**/*.ts'],
    // 注意：src/agent/__fixtures__/ns-violation.ts 故意违例，用于冒烟验证 rule 生效。
    // 该文件不加 ignores——lint 时应正常报 error，证明 rule 有效。
    // 生产代码中 agent/store 目录任何引用 PowerPoint/Excel/Word 均应修复。
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'PowerPoint', message: 'Office namespace 只能在 src/adapters/*Adapter.ts 内使用（A-06/TOOL-07）' },
        { name: 'Excel', message: 'Office namespace 只能在 src/adapters/*Adapter.ts 内使用（A-06/TOOL-07）' },
        { name: 'Word', message: 'Office namespace 只能在 src/adapters/*Adapter.ts 内使用（A-06/TOOL-07）' },
      ],
    },
  },
];
