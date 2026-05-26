# 存储 scope 验证（Spike #3）— PENDING

> ✅ **GATING**：FAIL 时写 GATING-FAILED-3.md，项目进入 PRD 修订状态

## 场景

在三宿主（PPT / Excel / Word for Web）分别测试 partitioned localStorage 行为：
- 文档 A 写 Key → 打开文档 B（同账号同浏览器）→ Key 仍可读
- 换浏览器（Edge → Chrome）→ Key 丢失（符合预期）
- 清除浏览器数据 → Key 丢失（符合预期）

验证 `Office.context.partitionKey` 的实际值与预期行为一致。

## 测试步骤

1. 在 PPT for Web 文档 A sideload spike manifest
2. 通过 Task Pane 写入 localStorage：`localStorage.setItem('aster-test-key', 'test-value-' + Date.now())`
3. 打开 PPT for Web 文档 B（同账号同浏览器）
4. 验证 localStorage 中 'aster-test-key' 的值
5. 在 Excel for Web 与 Word for Web 重复步骤 1-4
6. 测试跨浏览器：Edge 写入，Chrome 中同账号打开，验证 Key 不存在

## 实测结果

<!-- 填写时间：Day 1-2 -->

**PPT 宿主：**
- 文档 A → 文档 B 同账号同浏览器：（待填 key 是否可读）
- partitionKey 值：（待填）

**Excel 宿主：**
- 文档 A → 文档 B 同账号同浏览器：（待填）
- partitionKey 值：（待填）

**Word 宿主：**
- 文档 A → 文档 B 同账号同浏览器：（待填）
- partitionKey 值：（待填）

**跨浏览器测试：**
- Edge 写入 → Chrome 读取：（待填，预期 key 不存在）

## 证据

- [ ] 三宿主测试截图（DevTools Console 显示 localStorage 读取结果）
- [ ] 跨浏览器测试截图

> ⚠ 安全提示：测试用 `aster-test-key` 等明确测试名称，不要写入真实生产 API Key；截图前确认 Console 不含 Authorization header

## 决策

**结果：** PENDING

**PASS 条件：** 三宿主均确认文档间共享 localStorage（同 origin、同 browser），跨浏览器则丢失
PRD AC6 描述更新为实测行为

**FAIL 行动：**（仅在 FAIL 时填写）
- 当天写 `.planning/spikes/GATING-FAILED-3.md`
- 评估替代存储方案
