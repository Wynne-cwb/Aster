/**
 * src/adapters/wps/index.ts — WPS host→adapter 工厂（Phase 31，对位 src/adapters/index.ts）
 *
 * createWpsAdapter(componentType) 是 main-wps.tsx 三宿主分流的总入口。
 * 替代 Office.js 侧的 createAdapter(Office.HostType)。
 *
 * 懒加载（对齐 createAdapter）：按宿主 dynamic import，仅活跃宿主 adapter 进加载路径。
 * 注意：WPS 入口的 bundle 独立于 Office.js 主入口核算（NFR / Roadmap Phase 33）。
 */
import type { DocumentAdapter } from '../DocumentAdapter';
import { UnsupportedOperationError } from '../../errors';

/**
 * WPS Application.ComponentType 宿主判别值（WPS 官方约定）。
 * 1=文字(Word) / 2=表格(Excel/ET) / 3=演示(PPT/WPP)。
 */
export const WPS_COMPONENT = {
  WORD: 1,
  EXCEL: 2,
  PPT: 3,
} as const;

/**
 * createWpsAdapter — 按 WPS ComponentType 返回对应宿主 adapter。
 *
 * @param componentType `window.Application.ComponentType`（由 main-wps.tsx 读取传入）
 * @returns 对应宿主 adapter（Promise；Phase 31 为 stub，read/insert throw）
 * @throws UnsupportedOperationError 宿主值非 1/2/3
 */
export async function createWpsAdapter(componentType: number): Promise<DocumentAdapter> {
  switch (componentType) {
    case WPS_COMPONENT.PPT: {
      const { WpsPptAdapter } = await import('./WpsPptAdapter');
      return new WpsPptAdapter();
    }
    case WPS_COMPONENT.EXCEL: {
      const { WpsExcelAdapter } = await import('./WpsExcelAdapter');
      return new WpsExcelAdapter();
    }
    case WPS_COMPONENT.WORD: {
      const { WpsWordAdapter } = await import('./WpsWordAdapter');
      return new WpsWordAdapter();
    }
    default:
      throw new UnsupportedOperationError(
        'WPS 宿主 ComponentType 不受支持: ' + componentType + '（期望 1=文字/2=表格/3=演示）'
      );
  }
}
