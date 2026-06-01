/**
 * @author      ARR Official
 * @title       ChatGPT API Without Login
 * @description API endpoint untuk mengakses ChatGPT tanpa login, support streaming dan web search
 * @baseurl     https://chatgpt.com
 * @tags        ai, chat, chatgpt, openai, api
 * @language    javascript
 */

const crypto = require("crypto");
const { fetch: _fetch } = require("undici");

class ChatGPT {
  constructor(cfg = {}) {
    this.base        = "https://chatgpt.com";
    this.ua          = cfg.userAgent  ?? "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36";
    this.did         = cfg.did        ?? crypto.randomUUID();
    this.lang        = cfg.lang       ?? "id-ID";
    this.build       = cfg.buildNumber ?? "prod-69a06c53754594935887d6c16b844885964a78fc";
    this.screenW     = cfg.screenWidth  ?? 423;
    this.screenH     = cfg.screenHeight ?? 965;
    this.authToken   = cfg.authToken  ?? null;
  }

  // ─── Headers ────────────────────────────────────────────────────────────────
  _h(extra = {}) {
    return {
      "User-Agent"        : this.ua,
      "accept"            : "*/*",
      "accept-language"   : `${this.lang},en-US;q=0.9,en;q=0.8`,
      "content-type"      : "application/json",
      "OAI-Device-Id"     : this.did,
      "sec-ch-ua"         : '"Chromium";v="144", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile"  : "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-fetch-dest"    : "empty",
      "sec-fetch-mode"    : "cors",
      "sec-fetch-site"    : "same-origin",
      "origin"            : "https://chatgpt.com",
      "referer"           : "https://chatgpt.com/",
      ...(this.authToken ? { authorization: `Bearer ${this.authToken}` } : {}),
      ...extra,
    };
  }

  // ─── FNV-1a hash (untuk proof-of-work) ──────────────────────────────────────
  _fnv(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h  = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  // ─── Browser config payload ──────────────────────────────────────────────────
  _cfg() {
    return [
      this.screenW + this.screenH,
      String(new Date()),
      2172649472, 0,
      this.ua, null,
      this.build, this.lang, `${this.lang},en`,
      0, "contacts\u2212[object ContactsManager]", "_reactListening",
      "User", performance.now(), crypto.randomUUID(), "",
      8, performance.timeOrigin,
      0, 0, 0, 0, 0, 0, 0,
    ];
  }

  // ─── Proof-of-work solver ────────────────────────────────────────────────────
  _pow(seed, difficulty, cfg) {
    const t0 = performance.now();
    for (let i = 0; i < 500_000; i++) {
      cfg[3] = i;
      cfg[9] = Math.round(performance.now() - t0);
      const enc = Buffer.from(JSON.stringify(cfg)).toString("base64");
      if (this._fnv(seed + enc).substring(0, difficulty.length) <= difficulty)
        return "gAAAAAB" + enc + "~S";
    }
    return "wQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4De";
  }

  // ─── Generate sentinel tokens ────────────────────────────────────────────────
  async _tokens() {
    const cfg0 = this._cfg(); cfg0[3] = 1; cfg0[9] = 0;
    const initTok = "gAAAAAC" + Buffer.from(JSON.stringify(cfg0)).toString("base64");

    const prep = await _fetch(`${this.base}/backend-anon/sentinel/chat-requirements/prepare`, {
      method: "POST",
      headers: this._h(),
      body: JSON.stringify({ p: initTok }),
    }).then(r => r.json());

    let pow = null;
    if (prep.proofofwork?.required)
      pow = this._pow(prep.proofofwork.seed, prep.proofofwork.difficulty, this._cfg());

    const turnstile = crypto
      .randomBytes(Math.floor((2256 / 4) * 3))
      .toString("base64")
      .slice(0, 2256);

    const fb = { prepare_token: prep.prepare_token ?? "" };
    if (pow)       fb.proofofwork = pow;
    if (turnstile) fb.turnstile   = turnstile;

    const fin = await _fetch(`${this.base}/backend-anon/sentinel/chat-requirements/finalize`, {
      method: "POST",
      headers: this._h(),
      body: JSON.stringify(fb),
    }).then(r => r.json());

    return { pow, turnstile, chatRequirementsToken: fin.token ?? null };
  }

  // ─── Ambil conduit token ─────────────────────────────────────────────────────
  async _conduit(message, msgId, parentMsgId, { conversationId, webSearch } = {}) {
    const body = {
      action              : "next",
      fork_from_shared_post: false,
      parent_message_id   : parentMsgId,
      model               : "auto",
      timezone_offset_min : new Date().getTimezoneOffset(),
      timezone            : Intl.DateTimeFormat().resolvedOptions().timeZone,
      conversation_mode   : { kind: "primary_assistant" },
      system_hints        : webSearch ? ["search"] : [],
      supports_buffering  : true,
      supported_encodings : ["v1"],
      partial_query       : {
        id     : msgId,
        author : { role: "user" },
        content: { content_type: "text", parts: [message] },
      },
      client_contextual_info: { app_name: "chatgpt.com" },
    };
    if (conversationId) body.conversation_id = conversationId;

    const r = await _fetch(`${this.base}/backend-anon/f/conversation/prepare`, {
      method : "POST",
      headers: this._h({ "X-Conduit-Token": "no-token" }),
      body   : JSON.stringify(body),
    });
    const d = await r.json();
    return d.token ?? d.conduit_token;
  }

  // ─── Kirim pesan ─────────────────────────────────────────────────────────────
  async send(message, opts = {}) {
    if (!message?.trim()) throw new Error("Pesan tidak boleh kosong.");

    const {
      conversationId  = null,
      parentMessageId = null,
      webSearch       = false,
      stream          = false,
      onChunk,
    } = opts;

    const parentMsgId = parentMessageId ?? "client-created-root";
    const msgId       = crypto.randomUUID();

    const [tokens, conduit] = await Promise.all([
      this._tokens(),
      this._conduit(message, msgId, parentMsgId, { conversationId, webSearch }),
    ]);

    const body = {
      action  : "next",
      messages: [{
        id         : msgId,
        author     : { role: "user" },
        create_time: Date.now() / 1000,
        content    : { content_type: "text", parts: [message] },
        metadata   : {
          selected_github_repos : [],
          selected_all_github_repos: false,
          serialization_metadata: { custom_symbol_offsets: [] },
          ...(webSearch ? { system_hints: ["search"] } : {}),
        },
      }],
      parent_message_id  : parentMsgId,
      model              : "auto",
      timezone_offset_min: new Date().getTimezoneOffset(),
      timezone           : Intl.DateTimeFormat().resolvedOptions().timeZone,
      conversation_mode  : { kind: "primary_assistant" },
      enable_message_followups: true,
      system_hints       : webSearch ? ["search"] : [],
      supports_buffering : true,
      supported_encodings: ["v1"],
      client_contextual_info: {
        is_dark_mode   : true,
        time_since_loaded: 10,
        page_height    : 845,
        page_width     : 423,
        pixel_ratio    : 1.7,
        screen_height  : this.screenH,
        screen_width   : this.screenW,
        app_name       : "chatgpt.com",
      },
      no_auth_ad_preferences: { personalization_enabled: true, history_enabled: true },
      paragen_cot_summary_display_override: "allow",
      force_parallel_switch: "auto",
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(webSearch ? { force_use_search: true, client_reported_search_source: "conversation_composer_web_icon" } : {}),
    };

    const res = await _fetch(`${this.base}/backend-anon/f/conversation`, {
      method : "POST",
      body   : JSON.stringify(body),
      headers: this._h({
        "accept"                                   : "text/event-stream",
        "OAI-Language"                             : this.lang,
        "OpenAI-Sentinel-Chat-Requirements-Token"  : tokens.chatRequirementsToken,
        "OpenAI-Sentinel-Turnstile-Token"          : tokens.turnstile,
        "OpenAI-Sentinel-Proof-Token"              : tokens.pow,
        "X-Conduit-Token"                          : conduit,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "(no body)");
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    return this._parseSSE(res.body, { stream, onChunk });
  }

  // ─── Parse SSE stream ────────────────────────────────────────────────────────
  async _parseSSE(body, { stream, onChunk }) {
    const dec = new TextDecoder();
    let buf = "", fullText = "", title = null, model = null, convId = null, assistantMsgId = null;

    for await (const chunk of body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;

        let json; try { json = JSON.parse(raw); } catch { continue; }

        if (json.conversation_id)          convId = json.conversation_id;
        else if (json.v?.conversation_id)  convId = json.v.conversation_id;

        if (json.v && !Array.isArray(json.v) && json.v.message?.author?.role === "assistant")
          assistantMsgId = json.v.message.id;

        if (json.type === "title_generation")  title = json.title;
        if (json.type === "server_ste_metadata") model = json.metadata?.model_slug ?? null;

        const patches = Array.isArray(json.v) ? json.v : [];
        for (const p of patches) {
          if (p.o === "append" && p.p?.includes("/message/content/parts/0")) {
            fullText += p.v;
            if (stream && typeof onChunk === "function") onChunk(p.v);
          }
        }
      }
    }

    return { text: fullText, title, model, conversationId: convId, messageId: assistantMsgId };
  }
}

// ─── Registrasi endpoint ─────────────────────────────────────────────────────
module.exports = function (app) {
  const chat = new ChatGPT({ lang: "id-ID" });

  app.get("/chatgpt", async (req, res) => {
    try {
      const prompt         = req.query.q || req.query.prompt || req.query.text;
      const conversationId = req.query.conversation_id    || null;
      const parentMsgId    = req.query.parent_message_id  || null;
      const webSearch      = req.query.web_search === "true";
      const stream         = req.query.stream     === "true";

      if (!prompt) return res.status(400).json({
        status : false,
        error  : "Parameter 'q' diperlukan",
        example: "/chatgpt?q=siapa presiden Indonesia",
        creator: "ARR Official",
      });

      // ── Mode streaming ────────────────────────────────────────────────────────
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection",    "keep-alive");

        let fullText = "";
        await chat.send(prompt, {
          conversationId, parentMessageId: parentMsgId, webSearch,
          stream : true,
          onChunk: (chunk) => {
            fullText += chunk;
            res.write(`data: ${JSON.stringify({ chunk, fullText })}\n\n`);
          },
        });

        res.write("data: [DONE]\n\n");
        return res.end();
      }

      // ── Mode normal ───────────────────────────────────────────────────────────
      const result = await chat.send(prompt, {
        conversationId, parentMessageId: parentMsgId, webSearch, stream: false,
      });

      res.json({
        status         : true,
        creator        : "ARR Official",
        pertanyaan     : prompt,
        jawaban        : result.text,
        model          : result.model,
        title          : result.title,
        conversation_id: result.conversationId,
        message_id     : result.messageId,
      });

    } catch (err) {
      res.status(500).json({ status: false, error: err.message, creator: "ARR Official" });
    }
  });
};

// ─── Meta ────────────────────────────────────────────────────────────────────
module.exports.meta = {
  category : "AI Chat",
  tag      : "chatgpt",
  endpoints: [
    {
      method : "GET",
      path   : "/chatgpt",
      desc   : "Chat dengan ChatGPT tanpa login, support streaming dan web search",
      tryUrl : "/chatgpt?q=siapa presiden Indonesia",
      params : [
        { name: "q",                  required: true,  desc: "Pertanyaan / prompt" },
        { name: "conversation_id",    required: false, desc: "ID percakapan untuk lanjut chat" },
        { name: "parent_message_id",  required: false, desc: "ID pesan sebelumnya" },
        { name: "web_search",         required: false, desc: "Aktifkan web search (true/false)" },
        { name: "stream",             required: false, desc: "Mode streaming SSE (true/false)" },
      ],
    },
  ],
};
