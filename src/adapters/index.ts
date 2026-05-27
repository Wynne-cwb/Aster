/**
 * src/adapters/index.ts — host→adapter 工厂（FOUND-03）
 *
 * createAdapter(host) 是 main.tsx（plan 05）三宿主分流的总入口。
 * 消费方统一从此模块 import，无需单独 import 各 adapter 类。
 */
import type { DocumentAdapter } from './DocumentAdapter';
import { PptAdapter } from './PptAdapter';
import { ExcelAdapter } from './ExcelAdapter';
import { WordAdapter } from './WordAdapter';
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
 * @param host Office.HostType（由 main.tsx 在 Office.onReady 回调中传入）
 * @returns 对应宿主的 adapter 实例
 * @throws UnsupportedOperationError 如果宿主不受支持
 */
export function createAdapter(host: Office.HostType): DocumentAdapter {
  switch (host) {
    case Office.HostType.PowerPoint:
      return new PptAdapter();
    case Office.HostType.Excel:
      return new ExcelAdapter();
    case Office.HostType.Word:
      return new WordAdapter();
    default:
      throw new UnsupportedOperationError('当前宿主不受支持: ' + host);
  }
}
