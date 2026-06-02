/**
 * insertImage — 统一插图 helper（IMG-01/02 + Phase 18 LIB 复用）
 *
 * 设计约定（D-02 解耦架构）：
 *   - 由预览卡按钮触发（脱离 agent loop）
 *   - 调对应 host adapter 插图方法 + 写后回读（PPT 必须，已在 adapter 内部完成）
 *   - 成功后手动 appendOperation（带 humanLabel + reverse descriptor）
 *   - base64 不进 reverse.args（NFR-09：base64 不持久化）
 *
 * 真机 spike 结论（2026-06-02 Office for Web 实测，见 16-02-SUMMARY）：
 *   - PPT GA 路线（addGeometricShape + fill.setImage）成功，shape.id 可回读，bug #5022 已由独立 run 规避
 *   - fill.setImage / insertInlinePictureFromBase64 接受**裸 base64**（无 data: 前缀），本 helper 透传裸 base64 不拼前缀
 *   - Word body 级 insertInlinePictureFromBase64 正常（规避 range 级 bug #3434）
 *
 * PPT reverse: { tool: 'delete_shape_by_id', args: { slide_index, shape_id } }（Record 对象，非位置参）
 * Word reverse: { tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } }
 */
import type { PptAdapter } from '../adapters/PptAdapter';
import type { WordAdapter } from '../adapters/WordAdapter';
import { appendOperation, getOperationsByRun } from '../agent/operationLog';
import type { ToolError } from '../agent/tools/index';

export interface InsertImageOpts {
  /** PPT 用，1-based slide 序号 */
  slideIndex?: number;
  runId: string;
  humanLabel: string;
}

export interface InsertImageResult {
  ok: boolean;
  /** PPT 成功时返回，供 UI 确认展示 */
  shapeId?: string;
  error?: ToolError;
}

export async function insertImage(
  host: 'ppt',
  adapter: PptAdapter,
  base64: string,
  mimeType: string,
  opts: InsertImageOpts & { slideIndex: number },
): Promise<InsertImageResult>;

export async function insertImage(
  host: 'word',
  adapter: WordAdapter,
  base64: string,
  mimeType: string,
  opts: InsertImageOpts,
): Promise<InsertImageResult>;

/**
 * insertImage — 统一插图入口。
 * @param host 'ppt' | 'word'（Excel out-of-scope，IMG-05）
 * @param adapter 对应 host 的 adapter 实例
 * @param base64 裸 base64（无 data: 前缀，真机 spike 确认裸格式可用）
 * @param _mimeType mime 类型（当前 adapter 插图 API 不需要，保留供未来 / Phase 18 复用）
 * @param opts 插入选项（PPT 需 slideIndex；runId + humanLabel 必填）
 */
export async function insertImage(
  host: 'ppt' | 'word',
  adapter: PptAdapter | WordAdapter,
  base64: string,
  _mimeType: string,
  opts: InsertImageOpts & { slideIndex?: number },
): Promise<InsertImageResult> {
  if (host === 'ppt') {
    const pptAdapter = adapter as PptAdapter;
    const slideIndex = opts.slideIndex!;
    // 居中默认位置（D-06）：slide 720pt × 540pt（10inch × 7.5inch），
    // 图 480pt × 360pt（4:3），left=(720-480)/2=120, top=(540-360)/2=90
    const position = { left: 120, top: 90, width: 480, height: 360 };
    let shapeId: string;
    try {
      const result = await pptAdapter.addImageShape(slideIndex, base64, position);
      shapeId = result.newShapeId;
    } catch {
      // T-16-05：不读 err.message，用字面量（防 apiKey 从错误链泄漏）
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'PPT 图片插入失败，请重试',
          recoverable: false,
          hint: '宿主插图 API 失败；可能当前网页版暂不支持，建议手动插入图片',
        },
      };
    }
    // 手动追加 operationLog（D-02：绕过 dispatchTool 路径，必须手动）
    // stepIndex = 当前 run 已有条目数（Pitfall 5 防冲突）
    appendOperation({
      runId: opts.runId,
      stepIndex: getOperationsByRun(opts.runId).length,
      toolName: 'generate_ppt_image',
      args: {}, // 不存 base64（NFR-09）
      humanLabel: opts.humanLabel,
      reverse: {
        tool: 'delete_shape_by_id',
        args: { slide_index: slideIndex, shape_id: shapeId }, // Record 对象，非位置参
      },
      postState: {
        kind: 'ppt_shape_new',
        content: { slideIndex, shapeId }, // camelCase，与 D-17 analog + integration 守门一致
      },
      timestamp: Date.now(),
    });
    return { ok: true, shapeId };
  } else {
    const wordAdapter = adapter as WordAdapter;
    try {
      await wordAdapter.insertBodyImage(base64);
    } catch {
      // T-16-05：不读 err.message
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'Word 图片插入失败，请重试',
          recoverable: false,
          hint: '宿主插图 API 失败；请确认当前文档可编辑',
        },
      };
    }
    appendOperation({
      runId: opts.runId,
      stepIndex: getOperationsByRun(opts.runId).length,
      toolName: 'generate_word_image',
      args: {}, // 不存 base64（NFR-09）
      humanLabel: opts.humanLabel,
      reverse: { tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } },
      timestamp: Date.now(),
    });
    return { ok: true };
  }
}
