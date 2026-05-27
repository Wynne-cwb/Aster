import { i18n } from '@lingui/core';
import { messages } from './locales/zh-CN/messages';

// Load and activate zh-CN catalog at startup.
// Phase 1: only zh-CN is shipped (English i18n deferred to v1.1).
// After running `npm run extract` + `npm run compile`, the messages object
// will be populated with all extracted strings.
i18n.loadAndActivate({ locale: 'zh-CN', messages });

export { i18n };
