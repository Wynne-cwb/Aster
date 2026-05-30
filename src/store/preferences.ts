/**
 * src/store/preferences.ts — Phase 8 用户偏好 Store（PREF-01 / PREF-02）
 *
 * 职责：
 * - sanitizePrefs: 单一 prompt-injection 清洗点（OWASP LLM01）
 * - usePreferencesStore: 偏好持久化 store（partitioned localStorage via storage.ts）
 *
 * D-07: 全局一份三宿主通用，Settings 面板自由文本框
 * D-08: ≤500 字符上限（安全面，非防成本）
 * D-09: 命中注入词时静默过滤，不注入，不提示用户
 */

import { create } from 'zustand';
import { storage, STORAGE_KEYS } from '../lib/storage';

// ---------------------------------------------------------------------------
// Prompt Injection 防御（PREF-02 / D-09）
// OWASP LLM01:2025 — 攻击成功率 50-84%
// ---------------------------------------------------------------------------

const INJECTION_KEYWORDS = [
  // 中文直接指令
  '忽略', '无视', '跳过', '放弃上面', '现在开始', '从现在起',
  '你的新角色', '你现在是', '你是一个', '新的指令', '忘记',
  // 中文角色切换
  '扮演', '假设你是', '想象你是',
  // 英文直接注入
  'ignore', 'disregard', 'forget', 'override', 'new instruction',
  'your new role', 'you are now', 'act as', 'pretend',
  // 分隔符注入（常见绕过变体）
  '---', '===', '```system', '[INST]', '<<SYS>>',
  // 常见越狱前缀
  'DAN', 'jailbreak', 'bypass', 'system prompt',
];

/**
 * 注入检测：命中 INJECTION_KEYWORDS 中任意关键词返回 true（大小写不敏感）。
 * 用 includes 而非正则——保持简单，避免正则引擎灾难性回溯。
 */
function hasInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return INJECTION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * sanitizePrefs — 偏好文本清洗（PREF-02 / D-09）
 *
 * 返回规则：
 *   - 空/仅空白 → null
 *   - 长度 > 500 字符 → null（D-08 安全上限）
 *   - 命中 INJECTION_KEYWORDS → null（静默过滤，不提示用户，D-09）
 *   - 合法偏好 → raw.trim()
 */
export function sanitizePrefs(raw: string): string | null {
  if (!raw || raw.trim().length === 0) return null;
  if (raw.length > 500) return null;
  if (hasInjection(raw)) return null;
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Zustand Store（PREF-01）
// ---------------------------------------------------------------------------

interface PreferencesState {
  /** sanitize 后的偏好文本（null = 未设置或被 sanitize 过滤）*/
  userPrefs: string | null;
  /** 文本框显示内容（可能包含未通过 sanitize 的原始输入）*/
  rawInput: string;
  /** 保存偏好：存原始文本到 storage（显示用）+ 更新 userPrefs（sanitize 后）*/
  setPrefs(raw: string): void;
  /** 从 storage 读取偏好并 hydrate（main.tsx Office.onReady 内调用）*/
  loadPrefs(): void;
}

export const usePreferencesStore = create<PreferencesState>((set) => {
  // 初始 rawInput 从 storage 读取（同 providers.ts attachEnabled 模式：初始值直接在 create 内读）
  const storedRaw = storage.get<string>(STORAGE_KEYS.USER_PREFERENCES) ?? '';

  return {
    userPrefs: sanitizePrefs(storedRaw),
    rawInput: storedRaw,

    setPrefs(raw: string) {
      const sanitized = sanitizePrefs(raw);
      storage.set(STORAGE_KEYS.USER_PREFERENCES, raw); // 存原始文本（用于 rawInput 显示）
      set({ userPrefs: sanitized, rawInput: raw });
    },

    loadPrefs() {
      const stored = storage.get<string>(STORAGE_KEYS.USER_PREFERENCES);
      if (stored !== null) {
        set({ userPrefs: sanitizePrefs(stored), rawInput: stored });
      }
    },
  };
});
