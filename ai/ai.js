/**
 * @author      ARR Official
 * @title       DuckDuckGo AI Chat
 * @description API endpoint AI chat gratis tanpa login, tanpa API key
 * @baseurl     https://duckduckgo.com
 * @tags        ai, chat, duckduckgo, gpt, api
 * @language    javascript
 */

const { fetch: _fetch } = require("undici");

// Model yang tersedia di DDG
const MODELS = {
  gpt4o      : "gpt-4o-mini",
  claude     : "claude-3-haiku-20240307",
  llama      : "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  mixtral    : "mistralai/Mixtral-8x7B-Instruct-v0.1",
};
const DEFAULT_MODEL = "gpt-4o-mini";

class DuckAI {
  constructor() {
    this.base = "https://duckduckgo.com";
    this.ua   = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
  }

  // Ambil VQD token (wajib sebelum chat)
  async _getToken() {
    const res = await _fetch(`${this.base}/duckchat/v1/status`, {
      headers: {
        "User-Agent"  : this.ua,
        "x-vqd-accept": "1",
        "Referer"     : "https://duckduckgo.com/",
        "Origin"      : "https://duckduckgo.com",
      },
    });
    const token = res.headers.get("x-vqd-4");
    if (!token) throw new Error("Gagal mendapatkan VQD token dari DuckDuckGo.");
    return token;
  }

  async chat(message, opts = {}) {
    const model    = opts.model    ?? DEFAULT_MODEL;
    const history  = opts.history  ?? [];
    const stream   = opts.stream   ?? false;
    const onChunk  = opts.onChunk;
    const token    = opts.token    ?? await this._getToken();

    // Bangun history pesan
    const messages = [
      ...history,
      { role: "user", content: message },
    ];

    const res = await _fetch(`${this.base}/duckchat/v1/chat`, {
      method : "POST",
      headers: {
        "User-Agent"  : this.ua,
        "Content-Type": "application/json",
        "x-vqd-4"    : token,
        "Referer"     : "https://duckduckgo.com/",
        "Origin"      : "https://duckduckgo.com",
        "Accept"      : "text/event-stream",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "(no body)");
      throw new Error(`HTTP ${res.status}: ${err}`);
    }

    // Ambil token baru dari response (untuk lanjut percakapan)
    const newToken = res.headers.get("x-vqd-4") ?? token;

    // Parse SSE stream
    const dec = new TextDecoder();
    let buf = "", fullText = "";

    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;

        let json; try { json = JSON.parse(raw); } catch { continue; }

        const delta = json.message ?? "";
        if (delta) {
          fullText += delta;
          if (stream && typeof onChunk === "function") onChunk(delta);
        }
      }
    }

    return { text: fullText, token: newToken, model };
  }
}

// ─── Registrasi endpoint ─────────────────────────────────────────────────────
module.exports = function (app) {
  const ai = new DuckAI();

  app.get("/ai", async (req, res) => {
    try {
      const prompt  = req.query.q || req.query.prompt || req.query.text;
      const model   = MODELS[req.query.model] ?? DEFAULT_MODEL;
      const stream  = req.query.stream === "true";

      if (!prompt) return res.status(400).json({
        status : false,
        error  : "Parameter 'q' diperlukan",
        example: "/ai?q=siapa presiden Indonesia",
        models : Object.keys(MODELS),
        creator: "ARR Official",
      });

      // ── Mode streaming ──────────────────────────────────────────────────────
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection",    "keep-alive");

        let fullText = "";
        await ai.chat(prompt, {
          model,
          stream : true,
          onChunk: (chunk) => {
            fullText += chunk;
            res.write(`data: ${JSON.stringify({ chunk, fullText })}\n\n`);
          },
        });

        res.write("data: [DONE]\n\n");
        return res.end();
      }

      // ── Mode normal ─────────────────────────────────────────────────────────
      const result = await ai.chat(prompt, { model, stream: false });

      res.json({
        status    : true,
        creator   : "ARR Official",
        model     : result.model,
        pertanyaan: prompt,
        jawaban   : result.text,
      });

    } catch (err) {
      res.status(500).json({ status: false, error: err.message, creator: "ARR Official" });
    }
  });

  // ── Endpoint multi-turn (lanjut percakapan) ─────────────────────────────────
  app.post("/ai/chat", async (req, res) => {
    try {
      const { q, history = [], model: modelKey, token } = req.body;
      const model = MODELS[modelKey] ?? DEFAULT_MODEL;

      if (!q) return res.status(400).json({
        status : false,
        error  : "Field 'q' diperlukan di body",
        creator: "ARR Official",
      });

      const result = await ai.chat(q, { model, history, token, stream: false });

      res.json({
        status    : true,
        creator   : "ARR Official",
        model     : result.model,
        pertanyaan: q,
        jawaban   : result.text,
        token     : result.token, // simpan di client untuk lanjut chat
      });

    } catch (err) {
      res.status(500).json({ status: false, error: err.message, creator: "ARR Official" });
    }
  });
};

// ─── Meta ────────────────────────────────────────────────────────────────────
module.exports.meta = {
  category : "AI Chat",
  tag      : "ai",
  endpoints: [
    {
      method : "GET",
      path   : "/ai",
      desc   : "Chat AI gratis via DuckDuckGo, support streaming, tanpa API key",
      tryUrl : "/ai?q=siapa presiden Indonesia",
      params : [
        { name: "q",      required: true,  desc: "Pertanyaan / prompt" },
        { name: "model",  required: false, desc: `Pilih model: ${Object.keys(MODELS).join(" | ")} (default: gpt4o)` },
        { name: "stream", required: false, desc: "Mode streaming SSE (true/false)" },
      ],
    },
    {
      method : "POST",
      path   : "/ai/chat",
      desc   : "Multi-turn chat, kirim history percakapan untuk konteks",
      params : [
        { name: "q",       required: true,  desc: "Pesan baru" },
        { name: "history", required: false, desc: "Array [{role,content}] percakapan sebelumnya" },
        { name: "token",   required: false, desc: "Token dari response sebelumnya (untuk lanjut sesi)" },
        { name: "model",   required: false, desc: `Pilih model: ${Object.keys(MODELS).join(" | ")}` },
      ],
    },
  ],
};
