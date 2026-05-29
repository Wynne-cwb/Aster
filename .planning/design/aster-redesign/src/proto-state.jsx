/* Aster · Prototype state, data, canned replies */

const STORAGE_KEY = "aster.proto.state.v1";

/* 已知 Provider 的模型槽位结构。
   单槽 → 编辑页显示一个下拉框；多槽 → 多个下拉框（如 AIHubMix 拆为识别/生成）。 */
const PROVIDER_MODEL_SLOTS = {
  deepseek: [
    { key: "model", label: "模型 ID", options: ["deepseek-v4-pro", "deepseek-v4-flash"] },
  ],
  aihubmix: [
    { key: "visionModel", label: "图片识别模型", options: ["gpt-5o"] },
    { key: "imageModel", label: "图片生成模型", options: ["gpt-image-2"] },
  ],
};

/* 旧版兼容：保留单槽下拉框列表，供已有调用方继续工作 */
const PROVIDER_MODELS = {
  deepseek: ["deepseek-v4-pro", "deepseek-v4-flash"],
  aihubmix: ["gpt-5o", "gpt-image-2"],
};

/* 模型简介 — 用于编辑页 select 下方的提示 */
const MODEL_DESCRIPTIONS = {
  "deepseek-v4-pro": "通用对话与推理，复杂任务首选。",
  "deepseek-v4-flash": "轻量快速，成本更低，适合短问答。",
  "gpt-5o": "多模态，主要提供图片识别能力。",
  "gpt-image-2": "文生图，用于「为这张幻灯片配一张图」一类任务。",
};

const DEFAULT_PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    model: "deepseek-v4-pro",
    baseUrl: "https://api.deepseek.com/v1",
    key: "",
    inputPrice: "1.00",
    outputPrice: "2.00",
    toolCalling: true,
    builtIn: true,
  },
  {
    id: "aihubmix",
    name: "AIHubMix",
    model: "gpt-5o",
    visionModel: "gpt-5o",
    imageModel: "gpt-image-2",
    baseUrl: "https://aihubmix.com/v1",
    key: "",
    inputPrice: "1.20",
    outputPrice: "4.80",
    toolCalling: true,
    builtIn: true,
  },
  {
    id: "ollama",
    name: "自建 Ollama",
    model: "qwen2.5:14b",
    baseUrl: "http://127.0.0.1:11434/v1",
    key: "",
    inputPrice: "",
    outputPrice: "",
    toolCalling: false,
    builtIn: false,
  },
];

const HOSTS = {
  ppt: { label: "PPT", longLabel: "PowerPoint", desc: "第 3 张幻灯片" },
  xls: { label: "Excel", longLabel: "Excel", desc: "选中区域 A1:B10" },
  doc: { label: "Word", longLabel: "Word", desc: "选中 248 字" },
};

/* Seed messages share a fixed past timestamp so they don't drift each reload */
const SEED_TS = new Date(2026, 4, 28, 10, 14).getTime();

const INITIAL_STATE = {
  onboarded: false,
  view: "onboard-1",  // 'onboard-1' | 'onboard-2' | 'main' | 'settings-browse' | 'settings-edit'
  editingProviderId: null,
  providers: DEFAULT_PROVIDERS,
  defaultProviderId: "deepseek",
  autoAttachSelection: true,
  writebackMode: "confirm",   // 'confirm' | 'auto'
  pillVisible: true,
  pillOn: true,
  host: "ppt",
  // chat
  messages: [
    {
      id: "m1",
      role: "user",
      text: "把这张 slide 的三个要点改写得更口语化，控制在每条 20 字以内。",
      ts: SEED_TS,
    },
    {
      id: "m2",
      role: "ai",
      text: "好的，这是更口语化的版本，每条都收紧到 20 字以内：",
      list: [
        "把功能藏得太深，用户根本找不到。",
        "新人前 7 天活跃率只剩 `34%`。",
        "把\"导出\"挪到首页，预计可救回 12 个百分点。",
      ],
      cost: { tokens: 284, yuan: "0.0014" },
      writeback: {
        target: "替换 · 第 3 张幻灯片 · 要点 1-3",
        lines: [
          "· 把功能藏得太深，用户根本找不到。",
          "· 新人前 7 天活跃率只剩 34%。",
          "· 把\"导出\"挪到首页，预计可救回 12 个百分点。",
        ],
        decided: null,    // null | 'accept' | 'reject'
      },
      ts: SEED_TS + 60 * 1000,
    },
  ],
};

/* ---------- Persistence ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    // migrate: ensure built-in providers stay built-in even on older saved state,
    // and that their model slots have valid values so descriptions render immediately.
    if (Array.isArray(parsed.providers)) {
      parsed.providers = parsed.providers.map(p => {
        const def = DEFAULT_PROVIDERS.find(d => d.id === p.id);
        if (!def) return p;
        const next = { ...p, builtIn: def.builtIn ? true : p.builtIn };
        // built-in providers: lock name + baseUrl to current defaults
        if (def.builtIn) {
          next.name = def.name;
          next.baseUrl = def.baseUrl;
        }
        const slots = PROVIDER_MODEL_SLOTS[p.id] || [];
        slots.forEach(slot => {
          const current = next[slot.key];
          if (!current || !slot.options.includes(current)) {
            next[slot.key] = def[slot.key] || slot.options[0];
          }
        });
        return next;
      });
    }
    // shallow merge with INITIAL_STATE to handle new fields
    return { ...INITIAL_STATE, ...parsed };
  } catch (e) {
    return INITIAL_STATE;
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- Canned replies ---------- */

function pickReply(userText, providers) {
  const text = userText.toLowerCase();
  // keyword routing
  if (text.includes("公式") || text.includes("vlookup") || text.includes("sumifs")) {
    return {
      text: "这条公式可以用 `SUMIFS` 配合多列条件实现：",
      pre: '=SUMIFS(销售额, 区域, "华东", 季度, "Q3")',
      after: '把"华东"和"Q3"换成你要的条件就能复用。要不要我直接把它写到 D2 单元格里？',
      cost: { tokens: 142, yuan: "0.0006" },
      writeback: {
        target: "写入 · D2 单元格",
        lines: ['=SUMIFS(销售额, 区域, "华东", 季度, "Q3")'],
      },
    };
  }
  if (text.includes("总结") || text.includes("tl;dr") || text.includes("tldr") || text.includes("摘要")) {
    return {
      text: "选中段落讲的是三件事：",
      list: [
        "Q3 销售额同比下滑 18%，主要拖累在华南区。",
        "新用户付费转化反而上升 6%。",
        "下季度计划把营销预算从 SEM 转向 KOL。",
      ],
      cost: { tokens: 198, yuan: "0.0009" },
    };
  }
  if (text.includes("配图") || text.includes("图片") || text.includes("生图")) {
    return {
      text: "我可以给这张 slide 配图。你倾向于哪一种？",
      list: [
        "AI 生图（AIHubMix · 需配置 Key）",
        "图库素材（Unsplash 兼容协议）",
      ],
      after: "选一个我就给你 4 个候选。",
      cost: { tokens: 96, yuan: "0.0004" },
    };
  }
  if (text.includes("润色") || text.includes("改写") || text.includes("口语") || text.includes("严谨")) {
    return {
      text: "好的，把它改得更口语一点：",
      list: ["新人来一周，一半就走了。"],
      cost: { tokens: 78, yuan: "0.0003" },
    };
  }
  // default
  return {
    text: "我看一眼这一段。先简单回应：你这条需求里最关键的信息是想得到一个可以直接放进文档的版本，所以我会按这个目标来组织回答。\n\n如果你想换个角度，告诉我具体场景或受众，我可以再调一版。",
    cost: { tokens: 124, yuan: "0.0005" },
  };
}

/* ---------- Error catalog ---------- */

const ERROR_CATALOG = {
  KEY_INVALID: { code: "KEY_INVALID", text: "DeepSeek Key 无效。请到对应控制台核对后重新填写。", cta: "前往设置 →" },
  QUOTA: { code: "QUOTA", text: "本月配额已耗尽。可去 DeepSeek 控制台充值，或换一个 Provider。", cta: "切换 Provider" },
  RATE_LIMIT: { code: "RATE_LIMIT", text: "请求过于频繁。Aster 已在自动退避，稍后会重试。", info: "下次重试 5s 后" },
  CONTEXT: { code: "CONTEXT", text: "选中内容超过当前模型上下文上限。可缩小选区，或在设置中升级模型。", cta: "缩小选区" },
  NETWORK: { code: "NETWORK", text: "网络连接失败。请检查代理或公司网关。", cta: "重试" },
  FILTER: { code: "FILTER", text: "Provider 拒绝了这次请求的内容。可改写后再试。", cta: "重写问题" },
  MODEL: { code: "MODEL", text: '模型 "deepseek-reasoner-x" 不存在或已下线。', cta: "更换模型" },
  IMAGE_QUOTA: { code: "IMAGE_QUOTA", text: "AIHubMix 生图额度已用尽。文本继续可用。", cta: "前往设置 →" },
};

window.AsterProtoData = {
  STORAGE_KEY,
  DEFAULT_PROVIDERS,
  PROVIDER_MODELS,
  PROVIDER_MODEL_SLOTS,
  MODEL_DESCRIPTIONS,
  HOSTS,
  INITIAL_STATE,
  loadState,
  saveState,
  pickReply,
  ERROR_CATALOG,
};
