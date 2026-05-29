# sources/ — 冻结的设计真相源

这里是 **parked（不再变）** 的设计交付包快照，用于解释「为什么这么设计」。

- `design-package/README.md` — 权威 handoff（9 屏 + 交互行为 + token + 组件优先级 + 落地建议 + 已知缺口）
- `design-package/INDEX.md` — 对账结论（设计包 vs Aster v2.0 已锁决策）
- `design-package/aster.css` — 完整 token + 组件 CSS（~2000 行，含 dark 全色卡 + 撤销态等设计稿规格）

## ⚠️ 这不是线上真相

**线上像素级真相 = 仓库活文件**，不在这里（避免快照漂移）：
- `src/styles.css` — 已落地、已 UAT 的 CSS（含纯白底 #FFFFFF 等 UAT 偏差）
- `src/components/*.tsx` — 组件实现

设计稿与线上冲突时**一律以 `src/styles.css` 为准**。偏差清单见 `../references/design-tokens.md`。

浏览器可直开原型感受交互：`.planning/design/aster-redesign/src/Aster Prototype.html`
