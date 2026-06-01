/**
 * @author      ARR Official
 * @title       AI Chat (Pollinations)
 * @description API endpoint AI chat gratis tanpa login, tanpa API key, tanpa token
 * @baseurl     https://text.pollinations.ai
 * @tags        ai, chat, gpt, llama, api
 * @language    javascript
 */

const { fetch: _fetch } = require("undici");

const MODELS = {
  openai       : "openai",             // GPT-4o
  openai_mini  : "openai-fast",        // GPT-4o mini
  claude       : "claude-hybridspace", // Claude
  llama        : "llama",              // Llama 3.3 70B
  mistral      : "mistral",            // Mistral Nemo
  deepseek     : "deepseek",           // DeepSeek R1
  unity        : "unity",              // Unity (uncensored)
  searchgpt    : "searchgpt",          // GPT + web search
};
const DEFAULT_MODEL = "openai";

async function askAI(prompt, { model = DEFAULT_MODEL, system = "You are a helpful assistant.", seed = null } = {}) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: prompt },
    ],
    seed   : seed ?? Math.floor(Math.random() * 99999),
    private: true,
  };

  const res = await _fetch("https://text.pollinations.ai/openai", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "(no body)");
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Registrasi endpoint ──────────────────────────────────────────────────────
module.exports = function (app) {

  app.get("/ai", async (req, res) => {
    try {
      const prompt = req.query.q || req.query.prompt || req.query.text;
      const model  = MODELS[req.query.model] ?? DEFAULT_MODEL;
      const system = req.query.system ?? "You are a helpful assistant. Jawab dalam bahasa yang sama dengan pertanyaan user.";

      if (!prompt) return res.status(400).json({
        status : false,
        error  : "Parameter 'q' diperlukan",
        example: "/ai?q=siapa presiden Indonesia",
        models : Object.keys(MODELS),
        creator: "ARR Official",
      });

      const jawaban = await askAI(prompt, { model, system });

      res.json({
        status    : true,
        creator   : "ARR Official",
        model,
        pertanyaan: prompt,
        jawaban,
      });

    } catch (err) {
      res.status(500).json({ status: false, error: err.message, creator: "ARR Official" });
    }
  });

};

// ─── Meta ─────────────────────────────────────────────────────────────────────
module.exports.meta = {
  category : "AI Chat",
  tag      : "ai",
  endpoints: [
    {
      method : "GET",
      path   : "/ai",
      desc   : "Chat AI gratis via Pollinations, tanpa API key, tanpa token",
      tryUrl : "/ai?q=siapa presiden Indonesia",
      params : [
        { name: "q",      required: true,  desc: "Pertanyaan / prompt" },
        { name: "model",  required: false, desc: "Pilih model: openai | openai_mini | claude | llama | mistral | deepseek | unity | searchgpt (default: openai)" },
        { name: "system", required: false, desc: "System prompt custom (opsional)" },
      ],
    },
  ],
};
