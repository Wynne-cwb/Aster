/**
 * src/adapters/wps/WpsWordAdapter.ts — WPS 文字（金山文字）adapter
 *
 * Phase 31：stub（继承 WpsAdapterStub）。完整实现属 WPS-D1。
 */
import { WpsAdapterStub } from './WpsAdapterStub';

export class WpsWordAdapter extends WpsAdapterStub {
  protected readonly host = 'word' as const;
}
