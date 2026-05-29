/**
 * src/adapters/index.ts — host→adapter 工厂（FOUND-03）
 *
 * createAdapter(host) 是 main.tsx（plan 05）三宿主分流的总入口。
 * 消费方统一从此模块 import，无需单独 import 各 adapter 类。
 */
import type { DocumentAdapter } from './DocumentAdapter';
import { UnsupportedOperationError } from '../errors';

// re-export 契约类型，方便消费方单点 import
export type {
  DocumentAdapter,
  SelectionContext,
  InsertableContent,
  AdapterCapabilities,
  PptSelectionContext,
  ExcelSelectionContext,
  WordSelectionContext,
  NoneSelectionContext,
  TextContent,
  ParagraphsContent,
  BulletsContent,
  FormulaContent,
  RangeValuesContent,
  SlidesContent,
  ImageContent,
} from './DocumentAdapter';

/**
 * createAdapter — 按 Office.HostType 返回对应宿主的 DocumentAdapter 实现。
 *
 * 懒加载（CLAUDE.md §Bundle「解析库与 Provider SDK 必须懒加载」精神）：
 * 运行时只有一个宿主活跃，三个 adapter 各自的 read()/insert() 实现体量不小，
 * 全静态 import 会把另外两个宿主的死代码塞进初始 main chunk。改为按宿主
 * dynamic import，仅活跃宿主的 adapter 进入加载路径，另两个被 Vite 拆成独立
 * lazy chunk（不计入初始 80KB 预算）。调用点已在 main.tsx 的 async Office.onReady
 * 内，await 一次即可，引导顺序不变。
 *
 * @param host Office.HostType（由 main.tsx 在 Office.onReady 回调中传入）
 * @returns 对应宿主的 adapter 实例（Promise）
 * @throws UnsupportedOperationError 如果宿主不受支持（reject）
 */
export async function createAdapter(host: Office.HostType): Promise<DocumentAdapter> {
  switch (host) {
    case Office.HostType.PowerPoint: {
      const { PptAdapter } = await import('./PptAdapter');
      return new PptAdapter();
    }
    case Office.HostType.Excel: {
      const { ExcelAdapter } = await import('./ExcelAdapter');
      return new ExcelAdapter();
    }
    case Office.HostType.Word: {
      const { WordAdapter } = await import('./WordAdapter');
      return new WordAdapter();
    }
    default:
      throw new UnsupportedOperationError('当前宿主不受支持: ' + host);
  }
}
