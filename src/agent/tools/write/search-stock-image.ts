/**
 * src/agent/tools/write/search-stock-image.ts — search_and_insert_stock_image 工具（LIB-02 / LIB-03）
 *
 * 产品方向（Q1=B 拍板，memory project_image_insert_autonomous「Phase 18 图库同此」）：
 *   loop 内自动检索 Pexels → 选首张 → fetch full-res → 裸 base64 → 直插当前 slide（PPT）/ body（Word）。
 *   返回 shape_id（PPT）供 AI 后续 move_shape/set_shape_property/rotate_shape 自主排版。
 *   不做缩略图网格手动选；「换一张」= AI 重调工具递增 page（D-05）。
 *
 * 撤销（走标准 write-tool reverse 路径，单一 undo 记录，D-02 reconcile）：
 *   execute 直接调 adapter 插图方法 → 返回 reverse descriptor（+ postState，PPT）→
 *   loop-helpers 据此 appendOperation。与 generate_ppt_image/generate_word_image 完全一致。
 *   **绝不手动 appendOperation**（D-02 reconcile：脱离 loop 的旧 helper 路径已废弃删除）。
 *   PPT reverse = delete_shape_by_id（Record snake_case）；Word reverse = noop_inverse（诚实标注）。
 *
 * per-host（D-11）：只注册到 PPT + Word host（tools/index.ts buildToolsForHost）；Excel 不注册。
 *
 * 安全约束（T-14-01 / T-18-02 / NFR-09）：
 * - apiKey 只在 resolveAndFetchStockImage 内部 registry→searchPexels 流转，绝不进 ToolResult.data / Message.content。
 * - 错误 message 用中文字面量；console.error 打 devtools（不进 chat history）。
 * - ToolResult.data 绝不含 base64：署名缩略图用 photo.src.tiny 远程 URL（thumbnail_url，<img src> 不受 CORS 限制）。
 */
import { searchPexels, fetchPexelsImageToBase64 } from '../../../providers/pexels-client';
import type { PexelsPhoto } from '../../../providers/pexels-client';
import { ProviderRegistry } from '../../../providers/registry';
import { KeyInvalidError, RateLimitError } from '../../../errors';
import type { ToolDef, ToolResult, ToolError } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';
import type { PptAdapter } from '../../../adapters/PptAdapter';
import type { WordAdapter } from '../../../adapters/WordAdapter';
import type { ImageConfig } from '../../../providers/types';

/**
 * 图库慢工具超时（ms）。dispatchTool 默认 15s 会误杀：Pexels 检索 + full-res CDN
 * fetch→base64 可能数秒到数十秒（慢网/大图）。120s 覆盖并留余量（memory browser_image_gen_gotchas）。
 */
const STOCK_IMAGE_TIMEOUT_MS = 120_000;

/** 居中默认位置（同 ppt-image.ts D-06）：slide 720×540pt，图 480×360pt（4:3），left=120/top=90 */
const DEFAULT_IMAGE_POSITION = { left: 120, top: 90, width: 480, height: 360 };

const PEXELS_LOCALE = 'zh-CN'; // 影响元数据/排序，不影响英文关键词匹配（D-04）
const PEXELS_PER_PAGE = 10; // D-12：够 AI 翻几张「换一张」
const STOCK_IMAGE_TOOL_NAME = 'search_and_insert_stock_image';

type StockFetchOk = { ok: true; photo: PexelsPhoto; base64: string };
type StockFetchErr = { ok: false; error: ToolError };
type StockEmpty = { ok: true; empty: true }; // 无结果（让 AI 换 query）

/**
 * 共享内部 helper（DRY：PPT/Word 共用「读 key → 检索 → 选首张 → 取 base64」）。
 * base64 只作为返回值在 execute 内流转 → 立即喂 adapter 插图 API，绝不进 ToolResult.data（NFR-09）。
 */
async function resolveAndFetchStockImage(
  query: string,
  page: number,
  signal: AbortSignal | undefined,
): Promise<StockFetchOk | StockFetchErr | StockEmpty> {
  // 1. 读 key（registry.resolve 'stock-image'；KeyInvalidError → PERMISSION_DENIED 不可恢复）
  let cfg: ImageConfig;
  try {
    cfg = ProviderRegistry.resolve('stock-image', () => {
      throw new Error('unused');
    }) as ImageConfig;
  } catch (err) {
    if (err instanceof KeyInvalidError) {
      return {
        ok: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Pexels Key 未配置，请在设置中填写图库 Key',
          recoverable: false,
          hint: '前往设置 → 图库 / Pexels API Key',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'HOST_API_FAILED',
        message: '图库配置解析失败',
        recoverable: false,
        hint: '检查图库 Provider 配置',
      },
    };
  }

  // 2. 检索（429→RateLimitError→可恢复；NetworkError→可恢复；不读 err.message 拼 key）
  let photos: PexelsPhoto[];
  try {
    photos = await searchPexels(query, cfg.apiKey, cfg.baseURL, {
      per_page: PEXELS_PER_PAGE,
      page,
      locale: PEXELS_LOCALE,
      signal,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'Pexels 检索过于频繁，请稍后再试',
          recoverable: true,
          hint: '已达 Pexels 速率上限（200/小时）',
        },
      };
    }
    console.error('[search_and_insert_stock_image] 检索失败', err);
    return {
      ok: false,
      error: {
        code: 'HOST_API_FAILED',
        message: '图库检索失败，请重试',
        recoverable: true,
        hint: '网络或 CORS 失败（Office Web iframe）',
      },
    };
  }

  // 3. 无结果 → 让 AI 换 query（不算错误）
  if (!photos.length) return { ok: true, empty: true };

  // 4. 选首张（可依 alt 与 query 相关性挑最匹配；最简取 photos[0]）
  const photo = photos[0];

  // 5. full-res（large，避 original）→ 裸 base64（⚠️ CORS 风险面二，Phase 19 UAT）
  let base64: string;
  try {
    base64 = await fetchPexelsImageToBase64(photo.src.large, signal);
  } catch (err) {
    console.error('[search_and_insert_stock_image] 取图失败', err);
    return {
      ok: false,
      error: {
        code: 'HOST_API_FAILED',
        message: '图库图片获取失败，请重试',
        recoverable: true,
        hint: 'images.pexels.com CDN fetch 失败（可能 CORS）',
      },
    };
  }

  return { ok: true, photo, base64 };
}

/** query 入参校验（缺/空 → INVALID_ARGS 可恢复）。 */
function readQuery(args: unknown): string | null {
  const q = (args as Record<string, unknown>).query;
  return typeof q === 'string' && q.trim() ? q.trim() : null;
}

/** page/slide_index 取正整数，否则默认 1。 */
function readPositiveInt(value: unknown): number {
  return typeof value === 'number' && value >= 1 ? Math.floor(value) : 1;
}

const INVALID_QUERY_ERROR: ToolResult = {
  ok: false,
  error: {
    code: 'INVALID_ARGS',
    message: '请提供英文图片检索词（query）',
    recoverable: true,
    hint: '把用户中文意图翻译为英文关键词传入 query，如“海边日落”→“seaside sunset”',
  },
};

export const searchAndInsertStockImagePptTool: ToolDef = {
  name: STOCK_IMAGE_TOOL_NAME, // snake_case，须加入 PPT_TOOLS Set（tools/index.ts）
  kind: 'write',
  timeoutMs: STOCK_IMAGE_TIMEOUT_MS, // 覆盖默认 15s（检索 + full-res fetch 慢）
  description:
    '从 Pexels 免费图库检索正版照片并自动插入当前 PPT 幻灯片（居中），返回 shape_id 供后续 ' +
    'move_shape/set_shape_property 排版。query 请用英文关键词（把用户中文意图翻译成英文，' +
    '如“海边日落”→“seaside sunset”），英文召回质量更好。用户说“换一张”时递增 page 翻页。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '英文图片检索词（翻译用户意图为英文）' },
      slide_index: { type: 'number', description: '插入到第几张幻灯片（1开始）。默认 1。' },
      page: { type: 'number', description: '检索页码（1开始，默认 1；用户说“换一张”时递增翻页）。' },
    },
    required: ['query'],
  },
  humanLabel: (args) => {
    const q = String((args as Record<string, unknown>).query ?? '');
    return `搜索并插入图库图片：${q.slice(0, 20)}${q.length > 20 ? '…' : ''}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const query = readQuery(args);
    if (!query) return INVALID_QUERY_ERROR;
    const a = args as Record<string, unknown>;
    const slideIndex = readPositiveInt(a.slide_index);
    const page = readPositiveInt(a.page);

    const r = await resolveAndFetchStockImage(query, page, ctx.signal);
    if (!r.ok) return { ok: false, error: r.error };
    if ('empty' in r) {
      // 无结果：不插入、无 reverse，让 AI 换 query 或翻页（results:0 = 本页无匹配）
      return { ok: true, data: { results: 0, query } };
    }

    let newShapeId: string;
    try {
      const inserted = await (ctx.adapter as PptAdapter).addImageShape(
        slideIndex,
        r.base64, // 裸 base64（fill.setImage 接受无 data: 前缀）
        DEFAULT_IMAGE_POSITION,
      );
      newShapeId = inserted.newShapeId;
    } catch (err) {
      console.error('[search_and_insert_stock_image] PPT 插入失败', err);
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'PPT 图片插入失败，请重试',
          recoverable: true,
          hint: '宿主插图 API 失败；可能当前网页版暂不支持，建议手动插入图片',
        },
      };
    }

    // 标准 write-tool reverse 路径（loop-helpers 据此 appendOperation，单一 undo 记录）
    // reverse.args 用 Record 对象（snake_case，deleteShapeById 消费约定，memory adapter_inverse_signature）
    const reverse: ReverseDescriptor = {
      tool: 'delete_shape_by_id',
      args: { slide_index: slideIndex, shape_id: newShapeId },
    };
    // postState.content 用 camelCase（与 operationLog.integration.test 守门一致）
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_new',
      content: { slideIndex, shapeId: newShapeId },
    };

    return {
      ok: true,
      data: {
        shape_id: newShapeId, // AI 后续 move_shape/set_shape_property 排版
        slide_index: slideIndex,
        photographer: r.photo.photographer, // LIB-03 署名
        photographer_url: r.photo.photographer_url, // LIB-03 署名链接
        photo_url: r.photo.url, // Pexels 图片页（署名链接）
        alt: r.photo.alt,
        thumbnail_url: r.photo.src.tiny, // NFR-09：远程 URL（非 base64），仅 UI 署名卡消费
        inserted: true, // StockImageResultCard 渲染信号
      },
      reverse,
      postState,
    };
  },
};

export const searchAndInsertStockImageWordTool: ToolDef = {
  name: STOCK_IMAGE_TOOL_NAME, // per-host 注册，不与 PPT 冲突
  kind: 'write',
  timeoutMs: STOCK_IMAGE_TIMEOUT_MS,
  description:
    '从 Pexels 免费图库检索正版照片并自动插入当前 Word 文档末尾（inline picture）。' +
    'query 请用英文关键词（把用户中文意图翻译成英文，如“海边日落”→“seaside sunset”），' +
    '英文召回质量更好。用户说“换一张”时递增 page 翻页。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '英文图片检索词（翻译用户意图为英文）' },
      page: { type: 'number', description: '检索页码（1开始，默认 1；用户说“换一张”时递增翻页）。' },
    },
    required: ['query'],
  },
  humanLabel: (args) => {
    const q = String((args as Record<string, unknown>).query ?? '');
    return `搜索并插入图库图片（Word）：${q.slice(0, 20)}${q.length > 20 ? '…' : ''}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const query = readQuery(args);
    if (!query) return INVALID_QUERY_ERROR;
    const page = readPositiveInt((args as Record<string, unknown>).page);

    const r = await resolveAndFetchStockImage(query, page, ctx.signal);
    if (!r.ok) return { ok: false, error: r.error };
    if ('empty' in r) {
      return { ok: true, data: { results: 0, query } };
    }

    try {
      await (ctx.adapter as WordAdapter).insertBodyImage(r.base64); // 裸 base64
    } catch (err) {
      console.error('[search_and_insert_stock_image] Word 插入失败', err);
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'Word 图片插入失败，请重试',
          recoverable: true,
          hint: '宿主插图 API 失败；请确认当前文档可编辑',
        },
      };
    }

    // Word body 插图无法自动撤销 → noop_inverse 诚实模式（无 postState）
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: 'Word 图片插入暂不支持自动撤销' },
    };

    return {
      ok: true,
      data: {
        photographer: r.photo.photographer, // LIB-03 署名
        photographer_url: r.photo.photographer_url,
        photo_url: r.photo.url,
        alt: r.photo.alt,
        thumbnail_url: r.photo.src.tiny, // NFR-09：远程 URL（非 base64）
        inserted: true,
      },
      reverse,
    };
  },
};
