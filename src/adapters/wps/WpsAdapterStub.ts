/**
 * src/adapters/wps/WpsAdapterStub.ts — WPS adapter 共享 stub 基类（Phase 31）
 *
 * Phase 31 只搭外壳 + 宿主识别 + 复用层接线，**不实现任何 read/write**。
 * 三宿主 adapter 继承此基类：getSelection 返回安全空态（让 UI 能 boot），
 * read/insert 一律 throw —— 真实实现在 Phase 32（PPT 滩头堡）/ WPS-D1（Excel/Word 全量）。
 *
 * ⚠️ 投机性预写：本文件随 31-33 投机阶段产出，真机验证 pending（见 STATE.md 2026-06-29 决策）。
 *
 * 反模式守门（ARCHITECTURE §Anti-Patterns）：
 * - 方法体同步执行后 Promise.resolve，**不**模仿 Office.js 的 *.run()/load/sync
 * - **不**调 Office.isSetSupported（WPS 无 requirement set）
 */
import type {
  AdapterCapabilities,
  DocumentAdapter,
  InsertableContent,
  ReadableQuery,
  ReadableResult,
  SelectionContext,
} from '../DocumentAdapter';
import { UnsupportedOperationError } from '../../errors';

/** 各宿主 stub 的能力声明（静态；Phase 32 起按真实实现收紧 supportedInserts）。 */
type WpsHost = AdapterCapabilities['host'];

export abstract class WpsAdapterStub implements DocumentAdapter {
  protected abstract readonly host: WpsHost;

  /**
   * Phase 31 stub：返回空态，让 Task Pane 能正常 boot（不抛错，对齐 D-16 语义）。
   * 真实选区读取（同步 window.Application.* → Promise.resolve）在 Phase 32 实现。
   */
  async getSelection(): Promise<SelectionContext> {
    return { kind: 'none' };
  }

  /**
   * Phase 31 stub：WPS 选区事件订阅未接（Phase 32 接 Application 事件）。
   * 返回 no-op 解绑函数，满足 React useEffect cleanup 契约。
   */
  onSelectionChanged(_callback: () => void): () => void {
    return () => {
      /* no-op — Phase 32 实现真实事件解绑 */
    };
  }

  /** 静态能力声明。Phase 31 标 supportsSelectionEvents=false（未接事件）。 */
  capabilities(): AdapterCapabilities {
    return {
      host: this.host,
      supportsSelectionEvents: false,
      supportedInserts: [],
    };
  }

  async insert(_content: InsertableContent): Promise<void> {
    throw new UnsupportedOperationError(this.notImplementedMessage('insert'));
  }

  async read(_query: ReadableQuery): Promise<ReadableResult> {
    throw new UnsupportedOperationError(this.notImplementedMessage('read'));
  }

  private notImplementedMessage(method: string): string {
    const where = this.host === 'ppt' ? 'Phase 32（PPT 滩头堡）' : 'WPS-D1（Excel/Word 全量移植）';
    return `WPS ${this.host} adapter.${method}() 尚未实现 — 计划于 ${where}。当前为 Phase 31 外壳 stub。`;
  }
}
