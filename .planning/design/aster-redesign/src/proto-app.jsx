/* Aster · Prototype main app
   Quiet (克制) variant only. State managed with useState + persisted to localStorage.
*/

const { useState, useEffect, useRef, useCallback } = React;
const D = window.AsterProtoData;

/* =========================================================
   utility — markdown-lite renderer
   ========================================================= */
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${mo}-${da} ${h}:${m}`;
}

function renderInline(text) {
  const parts = [];
  let buf = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        if (buf) { parts.push(buf); buf = ""; }
        parts.push(<code key={parts.length}>{text.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  if (buf) parts.push(buf);
  return parts;
}

/* =========================================================
   ChatMessage
   ========================================================= */
function MessageBubble({ msg, onDecide }) {
  const time = msg.ts ? formatTime(msg.ts) : "";
  const [wbExpanded, setWbExpanded] = useState(false);
  const [expandedActions, setExpandedActions] = useState(() => new Set());
  const toggleAction = (i) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  if (msg.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="bubble bubble-user">{renderInline(msg.text)}</div>
        {time && <span className="msg-time">{time}</span>}
      </div>
    );
  }
  if (msg.role === "error") {
    const e = msg.err;
    return (
      <div className="msg msg-ai">
        <div className="err-bubble">
          <div className="head">
            <Icon name="alertTriangle" size={13} />
            <span className="code">{e.code}</span>
            {e.info && <span style={{ marginLeft: "auto", fontWeight: 400, color: "var(--text-3)", letterSpacing: 0, fontSize: 11 }}>{e.info}</span>}
          </div>
          <div>{e.text}</div>
          {e.cta && (<div><span className="cta">{e.cta}</span></div>)}
        </div>
        {time && <span className="msg-time">{time}</span>}
      </div>
    );
  }
  // AI
  return (
    <div className="msg msg-ai">
      <div className="bubble bubble-ai">
        {msg.text && <p>{renderInline(msg.text)}{msg.streaming ? <span className="caret" /> : null}</p>}
        {msg.list && (
          <ul>{msg.list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}</ul>
        )}
        {msg.pre && <pre>{msg.pre}</pre>}
        {msg.after && <p>{renderInline(msg.after)}</p>}
      </div>
      {msg.writeback && !msg.streaming && (() => {
        const wb = msg.writeback;
        const actions = wb.actions || [{ target: wb.target, lines: wb.lines || [] }];
        const isMulti = actions.length > 1;
        return (
          <div className={`writeback ${wb.decided === "undo" ? "is-undone" : ""}`.trim()} style={{ alignSelf: "stretch", maxWidth: "100%" }}>
            <div className="writeback-head">
              <span className="wb-status">
                <Icon name="check" size={11} />
                已写入
              </span>
              {isMulti ? (
                <span className="wb-count">{actions.length} 项修改</span>
              ) : (
                <span className="wb-target">{actions[0].target}</span>
              )}
              {wb.decided !== "undo" && (
                <button className="wb-undo" onClick={() => onDecide(msg.id, "undo")} title={isMulti ? "撤销全部" : "撤销此次修改"}>
                  <Icon name="refresh" size={11} />
                  {isMulti ? "撤销全部" : "撤销"}
                </button>
              )}
            </div>

            {!isMulti && (
              <>
                <ul className="writeback-body">
                  {(wbExpanded ? actions[0].lines : actions[0].lines.slice(0, 2)).map((l, i) => (
                    <li key={i}>{l.replace(/^[·•]\s*/, "")}</li>
                  ))}
                </ul>
                {actions[0].lines.length > 2 && (
                  <button
                    className="wb-toggle"
                    onClick={() => setWbExpanded(!wbExpanded)}
                    aria-expanded={wbExpanded}
                  >
                    <Icon name="chevronDown" size={11} className={wbExpanded ? "is-up" : ""} />
                    {wbExpanded ? "收起" : `展开剩余 ${actions[0].lines.length - 2} 项`}
                  </button>
                )}
              </>
            )}

            {isMulti && (
              <ul className="writeback-actions">
                {actions.map((a, i) => (
                  <li key={i}>
                    <button
                      className="wb-action-head"
                      aria-expanded={expandedActions.has(i)}
                      onClick={() => toggleAction(i)}
                    >
                      <Icon name="chevronDown" size={11} className="wb-chev" />
                      <span className="wb-action-target">{a.target}</span>
                    </button>
                    {expandedActions.has(i) && a.lines && a.lines.length > 0 && (
                      <ul className="wb-action-body">
                        {a.lines.map((l, j) => (
                          <li key={j}>{l.replace(/^[·•]\s*/, "")}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {wb.decided === "undo" && (
              <div className="writeback-undone">
                <Icon name="info" size={11} />
                <span>已撤销，文档已回滚到上一状态</span>
              </div>
            )}
          </div>
        );
      })()}
      {time && !msg.streaming && <span className="msg-time">{time}</span>}
    </div>
  );
}

/* =========================================================
   InputBar (eye only — no × per user request)
   ========================================================= */
function InputBar({ state, set, onSend, streaming, onStop, onGoSettings }) {
  const [text, setText] = useState("");
  const taRef = useRef(null);

  const send = () => {
    const v = text.trim();
    if (!v || streaming) return;
    onSend(v);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onInput = (e) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  const hostInfo = D.HOSTS[state.host];

  return (
    <div className="inputbar-wrap">
      <div className="inputbar">
        {state.pillVisible && (
          <div className="selpill-row">
            <span className="selpill">
              <Icon name="document" size={11} />
              <span className="label">{hostInfo.desc}</span>
              <span className="actions">
                <button
                  className="pill-btn"
                  data-off={!state.pillOn}
                  aria-label={state.pillOn ? "本次附带选区" : "不附带选区"}
                  title={state.pillOn ? "本次附带选区（点击关闭）" : "选区不附带（点击开启）"}
                  onClick={() => set({ pillOn: !state.pillOn })}
                >
                  <Icon name={state.pillOn ? "eye" : "eyeOff"} size={11} />
                </button>
              </span>
            </span>
          </div>
        )}
        <textarea
          ref={taRef}
          rows={2}
          placeholder={streaming ? "AI 正在回答…" : "输入消息…"}
          value={text}
          onChange={onInput}
          onKeyDown={onKey}
          disabled={streaming}
        />
        <div className="tools">
          <button
            className="tool-btn"
            aria-label="设置"
            title="设置"
            onClick={onGoSettings}
          >
            <Icon name="gear" size={15} strokeWidth={1.4} />
          </button>
          <button
            className="tool-btn"
            aria-disabled="true"
            title="文件上传即将开放"
            onClick={(e) => e.preventDefault()}
          >
            <Icon name="paperclip" size={15} />
          </button>
          <button
            className="send-btn"
            data-streaming={streaming || undefined}
            aria-label={streaming ? "停止" : "发送"}
            onClick={streaming ? onStop : send}
            disabled={!streaming && !text.trim()}
          >
            {streaming ? <Icon name="square" size={11} /> : <Icon name="send" size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ConfigBanner — shows if any required key is missing
   ========================================================= */
function ConfigBanner({ onGoSettings }) {
  return (
    <div className="pane-banner">
      <Icon name="alertCircle" size={12} />
      <span>请先配置 API Key</span>
      <span className="spacer" />
      <a onClick={onGoSettings}>前往设置 →</a>
    </div>
  );
}

/* =========================================================
   ContextRow — host-specific selection card + gear
   ========================================================= */
function ContextRow({ state, onGoSettings }) {
  const h = D.HOSTS[state.host];
  return (
    <div className="pane-context">
      <div className="ctx-pill" title={h.desc}>
        <span className="ctx-app">{h.label}</span>
        <span className="ctx-desc">· {h.desc}</span>
      </div>
      <button className="btn-icon" aria-label="设置" onClick={onGoSettings}>
        <Icon name="gear" size={15} strokeWidth={1.4} />
      </button>
    </div>
  );
}

/* =========================================================
   Onboarding
   ========================================================= */
function Onboarding({ step, state, set, onNext, onPrev, onClose }) {
  const [dsKey, setDsKey] = useState(state.providers.find(p => p.id === "deepseek")?.key || "");
  const [aiKey, setAiKey] = useState(state.providers.find(p => p.id === "aihubmix")?.key || "");

  const saveKeysAndNext = () => {
    const providers = state.providers.map(p => {
      if (p.id === "deepseek") return { ...p, key: dsKey };
      if (p.id === "aihubmix") return { ...p, key: aiKey };
      return p;
    });
    set({ providers, defaultProviderId: "deepseek" });
    onNext();
  };

  if (step === 1) {
    return (
      <div className="modal-scrim">
        <div className="modal">
          <div className="modal-brand">
            <AsterMark size={22} color="var(--accent)" />
            <span className="brand-name">Aster</span>
            <span className="brand-step">01 / 02</span>
          </div>
          <div className="modal-title">配置 LLM Provider</div>
          <div className="modal-sub">绑定一个 LLM Provider 之后即可开始对话。Key 保存在你本机的 Office 设置里，不经过任何中转。</div>

          <div className="modal-body">
            <div>
              <span className="label">DeepSeek API Key · 必填</span>
              <input
                className="input"
                type="password"
                placeholder="sk-..."
                value={dsKey}
                onChange={(e) => setDsKey(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
            </div>

            <div>
              <span className="label">AIHubMix API Key · 选填</span>
              <input
                className="input"
                placeholder="sk-..."
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              <div className="field-hint">用于生图与视觉理解，未配置时相关按钮自动停用。</div>
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>跳过</button>
            <button className="btn btn-primary btn-sm" onClick={saveKeysAndNext}>下一步</button>
          </div>
        </div>
      </div>
    );
  }

  // step 2
  return (
    <div className="modal-scrim">
      <div className="modal">
        <div className="modal-brand">
          <AsterMark size={22} color="var(--accent)" />
          <span className="brand-name">Aster</span>
          <span className="brand-step">02 / 02</span>
        </div>
        <div className="modal-title">Aster 在你常用的三个宿主里都能干活</div>
        <div className="modal-sub">具体能做什么取决于你选中的内容。下面是各宿主的常用动作。</div>

        <div className="modal-body">
          <div className="host-card ppt">
            <div className="host-mark"><img src="icons/office-ppt.svg" alt="" /></div>
            <div className="host-body">
              <div className="host-name">PowerPoint</div>
              <ul>
                <li>主题 → 整篇大纲与逐张内容</li>
                <li>为选中 slide 配图（AI 生图 + 图库）</li>
                <li>追问选中文本、改写要点</li>
              </ul>
            </div>
          </div>
          <div className="host-card xls">
            <div className="host-mark"><img src="icons/office-excel.svg" alt="" /></div>
            <div className="host-body">
              <div className="host-name">Excel</div>
              <ul>
                <li>自然语言 → 公式 + 解释卡</li>
                <li>选区数据清洗预览，确认后写回</li>
                <li>问"为什么这一列异常"</li>
              </ul>
            </div>
          </div>
          <div className="host-card doc">
            <div className="host-mark"><img src="icons/office-word.svg" alt="" /></div>
            <div className="host-body">
              <div className="host-name">Word</div>
              <ul>
                <li>多风格润色（严谨 / 口语 / 简洁 / 抒情）</li>
                <li>选区 TL;DR、大纲 → 长文</li>
                <li>语法与拼写校对</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost btn-sm" onClick={onPrev}>上一步</button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>开始使用</button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SettingsPanel — slide-in browse + edit
   ========================================================= */
function SettingsBrowse({ state, set, go }) {
  return (
    <>
      <div className="settings-head">
        <button className="btn-icon" aria-label="返回" onClick={() => go("main")}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="title">设置</span>
      </div>
      <div className="settings-body">
        <div className="section-label">Providers</div>
        {state.providers.map((p) => {
          const hasKey = !!p.key;
          const slots = D.PROVIDER_MODEL_SLOTS[p.id];
          const modelLabel = slots
            ? slots.map(s => p[s.key] || s.options[0]).join(" · ")
            : p.model;
          return (
            <div className="provider-row" key={p.id}>
              <div className="pinfo">
                <div className="pname-line">
                  <span className="pname">{p.name}</span>
                  {p.builtIn && <span className="badge badge-accent">默认</span>}
                  {hasKey
                    ? <span className="badge badge-success">已配 Key</span>
                    : <span className="badge">未配 Key</span>}
                </div>
                <div className="pmodel">{modelLabel}{p.baseUrl && p.baseUrl.includes("127.0.0.1") ? ` · ${p.baseUrl}` : ""}</div>
              </div>
              <div className="pactions">
                <button className="btn-icon" aria-label="编辑" onClick={() => { set({ editingProviderId: p.id }); go("settings-edit"); }}>
                  <Icon name="edit" size={14} />
                </button>
                {!p.builtIn && (
                  <button className="btn-icon" aria-label="更多"><Icon name="more" size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
        <div className="row-add" onClick={() => { set({ editingProviderId: "new" }); go("settings-edit"); }}>
          <Icon name="plus" size={14} />
          <span>新建 Provider</span>
        </div>

        <div className="section-label">全局</div>
        <div className="row-toggle">
          <div className="tinfo">
            <div className="tname">选中内容自动附带</div>
            <div className="tdesc">每次发送时，自动把当前选区描述作为上下文一并发送。</div>
          </div>
          <div
            className="switch"
            data-on={state.autoAttachSelection}
            onClick={() => set({ autoAttachSelection: !state.autoAttachSelection })}
          />
        </div>
        <div className="row-link" onClick={() => { set({ onboarded: false, view: "onboard-1" }); }}>
          <Icon name="refresh" size={14} />
          <span>重看引导</span>
          <Icon name="chevronRight" size={14} className="chevron" />
        </div>
        <div style={{ padding: "20px 14px 24px", fontSize: 11, color: "var(--text-3)", textAlign: "center", lineHeight: 1.6 }}>
          Aster · 开源 · BYO Key · 隐私透明<br/>
          v0.1.0 · 自带 Key 不经过任何中转
        </div>
      </div>
    </>
  );
}

function SettingsEdit({ state, set, go }) {
  const id = state.editingProviderId;
  const isNew = id === "new";
  const existing = isNew ? null : state.providers.find(p => p.id === id);
  const [form, setForm] = useState(() => existing || {
    id: "new-" + Date.now(),
    name: "",
    model: "",
    baseUrl: "",
    key: "",
    inputPrice: "",
    outputPrice: "",
    toolCalling: true,
    builtIn: false,
  });
  const [keyVisible, setKeyVisible] = useState(false);

  const save = () => {
    let providers;
    if (isNew) providers = [...state.providers, form];
    else providers = state.providers.map(p => p.id === form.id ? form : p);
    set({ providers, editingProviderId: null });
    go("settings-browse");
  };

  const u = (patch) => setForm(f => ({ ...f, ...patch }));

  return (
    <>
      <div className="settings-head">
        <button className="btn-icon" aria-label="返回" onClick={() => { set({ editingProviderId: null }); go("settings-browse"); }}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="title">{isNew ? "新建 Provider" : "编辑 Provider"}</span>
      </div>
      <div className="settings-body" style={{ padding: "14px 14px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
        {form.builtIn && (
          <div className="builtin-note">
            <Icon name="info" size={13} />
            <span>内置 Provider · 名称与 Base URL 不可改</span>
          </div>
        )}
        <div>
          <label className="label">名称</label>
          <input className="input" value={form.name} onChange={(e) => u({ name: e.target.value })} placeholder="例如：DeepSeek" disabled={form.builtIn} />
        </div>
        <div>
          <label className="label">Base URL</label>
          <input className="input" value={form.baseUrl} onChange={(e) => u({ baseUrl: e.target.value })} placeholder="https://api.example.com/v1" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} disabled={form.builtIn} />
        </div>
        {D.PROVIDER_MODEL_SLOTS[form.id] ? (
          D.PROVIDER_MODEL_SLOTS[form.id].map(slot => (
            <div key={slot.key}>
              <label className="label">{slot.label}</label>
              <div className="select-wrap">
                <select
                  className="input select"
                  value={form[slot.key] || slot.options[0]}
                  onChange={(e) => u({ [slot.key]: e.target.value })}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                >
                  {slot.options.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="select-caret"><Icon name="chevronDown" size={14} /></span>
              </div>
              {D.MODEL_DESCRIPTIONS[form[slot.key] || slot.options[0]] && (
                <div className="field-hint">{D.MODEL_DESCRIPTIONS[form[slot.key] || slot.options[0]]}</div>
              )}
            </div>
          ))
        ) : (
          <div>
            <label className="label">模型 ID</label>
            <input className="input" value={form.model} onChange={(e) => u({ model: e.target.value })} placeholder="deepseek-chat" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
          </div>
        )}
        <div>
          <label className="label">API Key</label>
          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={keyVisible ? "text" : "password"}
              value={form.key}
              onChange={(e) => u({ key: e.target.value })}
              placeholder="sk-..."
              style={{ paddingRight: 36, fontFamily: "var(--font-mono)", fontSize: 12 }}
            />
            <button
              className="btn-icon"
              style={{ position: "absolute", top: 4, right: 4 }}
              aria-label={keyVisible ? "隐藏" : "显示"}
              onClick={() => setKeyVisible(!keyVisible)}
            >
              <Icon name={keyVisible ? "eyeOff" : "eye"} size={14} />
            </button>
          </div>
        </div>
        <div style={{ height: 4 }} />
      </div>
      <div className="settings-foot">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { set({ editingProviderId: null }); go("settings-browse"); }}>取消</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={!form.name}>保存</button>
      </div>
    </>
  );
}

/* =========================================================
   ChatStream — empty or messages
   ========================================================= */
function ChatStream({ state, onDecide, scrollRef }) {
  return (
    <div className="chat-scroll" ref={scrollRef}>
      {state.messages.length === 0 ? (
        <div className="empty">
          <div className="empty-mark"><AsterMark size={32} color="var(--accent)" /></div>
          <h3>从你正在做的东西开始</h3>
          <p>选中文档里的内容，告诉 Aster 你想做什么。也可以直接试试下面的入口。</p>
          <div className="suggestions">
            <button>
              <Icon name="sparkles" size={14} />
              <span style={{ flex: 1, textAlign: "left" }}>把这张幻灯片的要点改成更口语化的版本</span>
              <Icon name="arrowRight" size={13} className="arrow" />
            </button>
            <button>
              <Icon name="image" size={14} />
              <span style={{ flex: 1, textAlign: "left" }}>为这张幻灯片配一张图</span>
              <Icon name="arrowRight" size={13} className="arrow" />
            </button>
            <button>
              <Icon name="type" size={14} />
              <span style={{ flex: 1, textAlign: "left" }}>根据主题生成 6 张幻灯片的大纲</span>
              <Icon name="arrowRight" size={13} className="arrow" />
            </button>
          </div>
        </div>
      ) : (
        <div className="chat">
          {state.messages.map(m => <MessageBubble key={m.id} msg={m} onDecide={onDecide} />)}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   App
   ========================================================= */
function App() {
  const [state, setState] = useState(() => D.loadState());
  const [tweaks, setTweaks] = useTweaks({
    theme: "light",
    nextError: "none",
  });
  const [streaming, setStreaming] = useState(false);
  const streamingRef = useRef(null);
  const chatRef = useRef(null);
  const userScrolledUp = useRef(false);

  // Persist on change
  useEffect(() => { D.saveState(state); }, [state]);

  const set = useCallback((patch) => setState(s => ({ ...s, ...patch })), []);

  // detect user scroll-up vs anchored-to-bottom
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUp.current = dist > 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [state.view]);

  // auto-stick to bottom when new message arrives (unless user scrolled up)
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    if (!userScrolledUp.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.messages.length, state.messages[state.messages.length - 1]?.text]);

  const go = (view) => set({ view });

  /* ---------- chat send + streaming sim ---------- */
  const stopStream = () => {
    if (streamingRef.current) {
      clearInterval(streamingRef.current);
      streamingRef.current = null;
    }
    setStreaming(false);
    setState(s => ({
      ...s,
      messages: s.messages.map(m => m.streaming ? { ...m, streaming: false } : m),
    }));
  };

  const onSend = (text) => {
    const userMsg = { id: "u" + Date.now(), role: "user", text, ts: Date.now() };
    setState(s => ({ ...s, messages: [...s.messages, userMsg] }));

    // simulate response
    setTimeout(() => {
      // possibly inject error
      if (tweaks.nextError && tweaks.nextError !== "none") {
        const err = D.ERROR_CATALOG[tweaks.nextError];
        const errMsg = { id: "e" + Date.now(), role: "error", err, ts: Date.now() };
        setState(s => ({ ...s, messages: [...s.messages, errMsg] }));
        setTweaks({ nextError: "none" });
        return;
      }
      const reply = D.pickReply(text);
      const aiId = "a" + Date.now();
      const target = { ...reply, id: aiId, role: "ai", streaming: false, ts: Date.now() };

      // build the stream — chunk text by sliced characters
      const fullText = target.text || "";
      const chunkSize = 2;
      let cursor = 0;

      // initial empty message
      setState(s => ({
        ...s,
        messages: [...s.messages, { ...target, text: "", list: undefined, pre: undefined, after: undefined, cost: undefined, writeback: undefined, streaming: true }],
      }));
      setStreaming(true);

      streamingRef.current = setInterval(() => {
        cursor += chunkSize;
        const progressing = cursor < fullText.length;
        const slicedText = fullText.slice(0, cursor);

        setState(s => ({
          ...s,
          messages: s.messages.map(m => {
            if (m.id !== aiId) return m;
            if (progressing) {
              return { ...m, text: slicedText, streaming: true };
            }
            // done: fill in everything
            return {
              ...m,
              text: fullText,
              list: target.list,
              pre: target.pre,
              after: target.after,
              cost: target.cost,
              writeback: target.writeback ? { ...target.writeback, decided: null } : undefined,
              streaming: false,
            };
          }),
        }));

        if (!progressing) {
          clearInterval(streamingRef.current);
          streamingRef.current = null;
          setStreaming(false);
        }
      }, 28);
    }, 220);
  };

  const onDecide = (msgId, decision) => {
    setState(s => ({
      ...s,
      messages: s.messages.map(m => {
        if (m.id !== msgId) return m;
        return { ...m, writeback: { ...m.writeback, decided: decision } };
      }),
    }));
  };

  /* ---------- onboarding ---------- */
  const closeOnboarding = () => {
    set({ onboarded: true, view: "main" });
  };

  /* ---------- key configured? ---------- */
  const defaultProvider = state.providers.find(p => p.id === state.defaultProviderId);
  const keyMissing = !defaultProvider || !defaultProvider.key;
  const showBanner = state.onboarded && keyMissing;

  // Reset chat helper for tweaks
  const resetChat = () => setState(s => ({ ...s, messages: [] }));
  const seedChat = () => setState(s => ({ ...s, messages: D.INITIAL_STATE.messages }));
  const seedMultiChat = () => setState(s => ({
    ...s,
    messages: [
      {
        id: "mu1",
        role: "user",
        text: "把这份 PPT 重新过一遍：要点改口语化、给前两张配上图、最后插一页 TL;DR。",
        ts: Date.now() - 1000 * 60 * 2,
      },
      {
        id: "ma1",
        role: "ai",
        text: "搞定，下面是这次同时跑的几个改动：",
        writeback: {
          actions: [
            {
              target: "替换 · 第 3 张 · 要点 1-3",
              lines: [
                "把功能藏得太深，用户根本找不到。",
                "新人前 7 天活跃率只剩 34%。",
                "把\"导出\"挪到首页，预计可救回 12 个百分点。",
              ],
            },
            {
              target: "替换 · 第 5 张 · 要点 1-2",
              lines: [
                "增长曲线 Q3 转平，主因是激活漏斗第二步。",
                "调整后转化率从 18% → 27%。",
              ],
            },
            {
              target: "配图 · 第 1 张",
              lines: ["生成抽象渐变作为封面背景。"],
            },
            {
              target: "配图 · 第 2 张",
              lines: ["插入产品截图占位。"],
            },
            {
              target: "插入 · 第 12 张 · TL;DR 总结",
              lines: [
                "把功能藏得太深 → 用户找不到。",
                "活跃率连降两月。",
                "导出 + TL;DR 是本周首要优化。",
              ],
            },
          ],
          decided: null,
        },
        ts: Date.now() - 1000 * 60,
      },
    ],
  }));

  /* ---------- views ---------- */
  // accent + bubble style are locked in for now (#009887 teal · filled)
  const paneClasses = `pane v-quiet acc-teal bs-filled`;

  const showOnboarding = !state.onboarded;
  const settingsOpen = state.view === "settings-browse" || state.view === "settings-edit";

  return (
    <div className="stage" data-host-theme={tweaks.theme}>
      <div className="stage-meta">
        <span className="dot" />
        <strong>Aster</strong>
        <span>{D.HOSTS[state.host].longLabel.toUpperCase()} · TASK PANE · 350PX</span>
      </div>

      <div className={paneClasses} data-theme={tweaks.theme}>
        {/* main content layer */}
        {showBanner && <ConfigBanner onGoSettings={() => go("settings-browse")} />}
        <ChatStream state={state} onDecide={onDecide} scrollRef={chatRef} />
        <InputBar
          state={state}
          set={set}
          onSend={onSend}
          streaming={streaming}
          onStop={stopStream}
          onGoSettings={() => go("settings-browse")}
        />

        {/* settings slide-in overlay */}
        <div className={`settings-overlay${settingsOpen ? " is-open" : ""}`}>
          {state.view === "settings-browse" && <SettingsBrowse state={state} set={set} go={go} />}
          {state.view === "settings-edit" && <SettingsEdit state={state} set={set} go={go} />}
        </div>

        {/* onboarding modal */}
        {showOnboarding && state.view === "onboard-1" && (
          <Onboarding step={1} state={state} set={set}
            onNext={() => set({ view: "onboard-2" })}
            onClose={closeOnboarding}
          />
        )}
        {showOnboarding && state.view === "onboard-2" && (
          <Onboarding step={2} state={state} set={set}
            onPrev={() => set({ view: "onboard-1" })}
            onClose={closeOnboarding}
          />
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="主题 · 跟随宿主" />
        <TweakRadio
          label="Office theme"
          value={tweaks.theme}
          options={["light", "dark"]}
          onChange={(v) => setTweaks({ theme: v })}
        />

        <TweakSection label="演示宿主" />
        <TweakRadio
          label="Host"
          value={state.host}
          options={["ppt", "xls", "doc"]}
          onChange={(v) => set({ host: v })}
        />

        <TweakSection label="调试" />
        <TweakSelect
          label="下次回复模拟错误"
          value={tweaks.nextError}
          options={["none", "KEY_INVALID", "QUOTA", "RATE_LIMIT", "CONTEXT", "NETWORK", "FILTER", "MODEL", "IMAGE_QUOTA"]}
          onChange={(v) => setTweaks({ nextError: v })}
        />
        <TweakButton label="重看引导" onClick={() => { set({ onboarded: false, view: "onboard-1" }); }} />
        <TweakButton label="清空对话" onClick={resetChat} />
        <TweakButton label="塞入示例对话" onClick={seedChat} />
        <TweakButton label="塞入多动作示例" onClick={seedMultiChat} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
