import { execSync } from 'node:child_process';
import { describe, it } from 'vitest';

const CATALOG = 'src/i18n/locales/zh-CN/messages.po';

describe('Lingui catalog coverage', () => {
  it('messages.po 已包含源码全部宏文案（漏抽 → fail）', () => {
    execSync('npx lingui extract', { stdio: 'pipe' });
    try {
      execSync(`git diff --quiet --exit-code ${CATALOG}`);
    } catch {
      const diff = execSync(`git diff ${CATALOG}`, { encoding: 'utf8' });
      execSync(`git checkout -- ${CATALOG}`);
      throw new Error(
        `${CATALOG} 缺少新引入的 <Trans>/t\`\` 文案。\n` +
          '修复：运行 `npm run extract`，把变更后的 messages.po 一并提交。\n\n' +
          `--- 缺失/变更条目（前 60 行）---\n${diff.split('\n').slice(0, 60).join('\n')}`
      );
    }
  });
});
