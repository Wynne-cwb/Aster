import type { LinguiConfig } from '@lingui/conf';

const config: LinguiConfig = {
  locales: ['zh-CN'],
  sourceLocale: 'zh-CN',
  catalogs: [
    {
      path: 'src/i18n/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  compileNamespace: 'es',
  format: 'po',
};

export default config;
