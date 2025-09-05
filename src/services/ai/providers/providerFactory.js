// src/services/ai/providers/providerFactory.js
// Returns { summarize, extractActions, keywords, embed }

function createProvider(cfg) {
  const p = (cfg && cfg.provider) || process.env.AI_PROVIDER || 'hybrid-openai';
  switch (p) {
    case 'openai':            return openAIProvider(cfg || {});
    case 'openrouter':        return openRouterProvider(cfg || {});
    case 'local-emb':         return xenovaEmbeddingsProvider();
    case 'hybrid-openai':     return hybridOpenAI(cfg || {});     // OpenAI chat + Xenova emb
    case 'hybrid-openrouter': return hybridOpenRouter(cfg || {}); // OpenRouter chat + Xenova emb
    default:                  return noopProvider();
  }
}

/* ---------------- OpenAI (chat only) ---------------- */
function openAIProvider(cfg) {
  const baseUrl = cfg.baseUrl || 'https://api.openai.com/v1';
  const apiKey  = cfg.apiKey  || process.env.OPENAI_API_KEY;
  const model   = cfg.model   || 'gpt-4o-mini';
  if (!apiKey) throw new Error('OpenAI API key missing');

  async function chat(messages, opts = {}) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, temperature: opts.temperature ?? 0.2,
        response_format: opts.response_format,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI chat error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  const summarize = async (text) =>
    (await chat(
      [
        { role: 'system', content: 'You are a concise, structured note-taker.' },
        { role: 'user',   content: `Summarize clearly in <=1 short paragraph:\n\n${text}` },
      ],
      { temperature: 0.2 }
    )).trim();

  const extractActions = async (text) => {
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON action items.' },
        { role: 'user',   content:
`Extract action items as JSON exactly:
{ "actions": [ { "title": string, "owner": string|null, "due": string|null, "ts": number|null } ] }
Transcript:
${text}` }
      ],
      { response_format: { type: 'json_object' }, temperature: 0.0 }
    );
    try { const obj = JSON.parse(content); return Array.isArray(obj.actions) ? obj.actions : []; } catch { return []; }
  };

  const keywords = async (text) => {
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON keywords.' },
        { role: 'user',   content: `Return JSON { "keywords": [string] } with 3–8 concise keywords:\n${text}` }
      ],
      { response_format: { type: 'json_object' }, temperature: 0.0 }
    );
    try { const obj = JSON.parse(content); return Array.isArray(obj.keywords) ? obj.keywords : []; } catch { return []; }
  };

  const embed = async () => { throw new Error('Embeddings not provided by OpenAI provider here'); }
  return { summarize, extractActions, keywords, embed };
}

/* ---------------- OpenRouter (chat only) ---------------- */
function openRouterProvider(cfg) {
  const baseUrl = cfg.baseUrl || process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1';
  const apiKey  = cfg.apiKey  || process.env.OPENROUTER_API_KEY;
  const model   = cfg.model   || process.env.OPENROUTER_MODEL || 'meta/llama-3.1-8b-instruct';
  const referer = cfg.referer || process.env.OPENROUTER_REFERER || 'http://localhost';
  const title   = cfg.title   || process.env.OPENROUTER_TITLE || 'Classroom Assistant';
  if (!apiKey) throw new Error('OpenRouter API key missing');

  async function chat(messages, opts = {}) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': title,
      },
      body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.2 }),
    });
    if (!res.ok) throw new Error(`OpenRouter chat error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }

  const summarize = async (text) =>
    (await chat(
      [
        { role: 'system', content: 'You are a concise, structured note-taker.' },
        { role: 'user',   content: `Summarize clearly in <=1 short paragraph:\n\n${text}` },
      ],
      { temperature: 0.2 }
    )).trim();

  const extractActions = async (text) => {
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON action items.' },
        { role: 'user',   content:
`Extract action items as JSON exactly:
{ "actions": [ { "title": string, "owner": string|null, "due": string|null, "ts": number|null } ] }
Transcript:
${text}` }
      ],
      { temperature: 0.0 }
    );
    try { const obj = JSON.parse(content); return Array.isArray(obj.actions) ? obj.actions : []; } catch { return []; }
  };

  const keywords = async (text) => {
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON keywords.' },
        { role: 'user',   content: `Return JSON { "keywords": [string] } with 3–8 concise keywords:\n${text}` }
      ],
      { temperature: 0.0 }
    );
    try { const obj = JSON.parse(content); return Array.isArray(obj.keywords) ? obj.keywords : []; } catch { return []; }
  };

  const embed = async () => { throw new Error('Embeddings not supported via OpenRouter'); }
  return { summarize, extractActions, keywords, embed };
}

/* ---------------- Local embeddings (Xenova) ---------------- */
function xenovaEmbeddingsProvider() {
  let pipePromise = null;
  async function getPipe() {
    if (!pipePromise) {
      const { pipeline } = await import('@xenova/transformers');
      pipePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return pipePromise;
  }
  const embed = async (texts) => {
    const pipe = await getPipe();
    const out = [];
    for (const t of texts) {
      const res = await pipe(t, { pooling: 'mean', normalize: true });
      out.push(res.data); // Float32Array
    }
    return out;
  };
  return { summarize: async () => '', extractActions: async () => [], keywords: async () => [], embed };
}

/* ---------------- Hybrids ---------------- */
function hybridOpenAI(cfg)      { return combine(xenovaEmbeddingsProvider(), openAIProvider(cfg)); }
function hybridOpenRouter(cfg)  { return combine(xenovaEmbeddingsProvider(), openRouterProvider(cfg)); }

function combine(emb, llm) {
  return {
    summarize: llm.summarize,
    extractActions: llm.extractActions,
    keywords: llm.keywords,
    embed: emb.embed,
  };
}

/* ---------------- Safe no-op ---------------- */
function noopProvider() {
  return {
    summarize: async () => '',
    extractActions: async () => [],
    keywords: async () => [],
    embed: async (texts) => texts.map(() => null),
  };
}

module.exports = { createProvider };
