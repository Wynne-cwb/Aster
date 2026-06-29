/**
 * src/adapters/wps/WpsExcelAdapter.ts — WPS 表格（金山表格/ET）adapter
 *
 * Phase 31：stub（继承 WpsAdapterStub）。完整实现属 WPS-D1（或若 Phase 32 滩头堡选 Excel）。
 */
import { WpsAdapterStub } from './WpsAdapterStub';

export class WpsExcelAdapter extends WpsAdapterStub {
  protected readonly host = 'excel' as const;
}
