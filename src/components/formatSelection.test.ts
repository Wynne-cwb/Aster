/**
 * 上下文卡动态消息 — catalog 解析守卫（ROADMAP SC3 / Test 3 回归）。
 *
 * 为什么测 catalog 而不是直接调 formatSelection：
 * formatSelection 用 `msg`（@lingui/core/macro）宏。生产构建由 @lingui/vite-plugin
 * 转换该宏（已验证 dist 内嵌编译 catalog 且能解析），但 vitest 不会转换无 JSX 的
 * 纯 .ts 里的宏（@vitejs/plugin-react 跳过），故测试里无法直接执行 formatSelection。
 *
 * 真正的 Test 3 bug 是「动态插值消息没被 extract 进 catalog → 运行时渲染空白」。
 * 这里用 generateMessageId（与宏同一套 id 生成）+ 真实 i18n 解析编译后的 catalog，
 * 直接守住该失败模式：若某条动态消息没进 catalog 或解析不出，本测试失败。
 * 这弥补了旧测试用 identity-mock t 造成的盲区（旧测试永远绿，却没碰真 Lingui）。
 */
import { describe, it, expect } from 'vitest';
import { setupI18n } from '@lingui/core';
import { generateMessageId } from '@lingui/message-utils/generateMessageId';
import { messages } from '../i18n/locales/zh-CN/messages';

// 真实 i18n：加载实际编译的 zh-CN catalog（与生产同一份）
const i18n = setupI18n();
i18n.load('zh-CN', messages);
i18n.activate('zh-CN');

/** 按消息模板（宏生成的 message）取其 catalog id，确保与 formatSelection 的 ms`` 一致 */
function resolve(message: string, values?: Record<string, unknown>): string {
  const id = generateMessageId(message);
  // 守卫 1：该消息必须存在于编译后的 catalog（否则 = 没被 extract/compile 进去）
  expect(messages, `catalog 缺少消息「${message}」(id=${id})`).toHaveProperty(id);
  // 守卫 2：真实 i18n 必须能解析出正确插值结果
  return i18n._(id, values);
}

describe('上下文卡动态消息进入 catalog 且正确解析（Test 3 回归）', () => {
  it('PPT「第 N 张 slide」— slideIndex 1-based 直接显示（CR-01 不再 off-by-one）', () => {
    expect(resolve('第 {0} 张 slide', { 0: 1 })).toBe('第 1 张 slide');
    expect(resolve('第 {0} 张 slide', { 0: 5 })).toBe('第 5 张 slide');
  });

  it('Excel「选中区域 {address}」', () => {
    expect(resolve('选中区域 {0}', { 0: 'A1:C10' })).toBe('选中区域 A1:C10');
  });

  it('Word「选中 {n} 字」', () => {
    expect(resolve('选中 {0} 字', { 0: 12 })).toBe('选中 12 字');
  });

  it('无选中占位「未选中内容」', () => {
    expect(resolve('未选中内容')).toBe('未选中内容');
  });
});
