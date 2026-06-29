/**
 * src/adapters/wps/WpsPptAdapter.ts — WPS 演示（金山演示/WPP）adapter
 *
 * Phase 31：stub（继承 WpsAdapterStub，read/insert throw）。
 * Phase 32：滩头堡首宿主候选，实现核心 read/write/inverse（VBA 风格同步 API +
 *           Promise.resolve；inverse 收 Record 对象签名，operationLog 守门）。
 */
import { WpsAdapterStub } from './WpsAdapterStub';

export class WpsPptAdapter extends WpsAdapterStub {
  protected readonly host = 'ppt' as const;
}
