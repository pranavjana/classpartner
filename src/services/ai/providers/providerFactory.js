// src/services/ai/providers/providerFactory.js
// Returns { summarize, extractActions, keywords, embed }

// Import Vercel AI SDK components
const { google } = require('@ai-sdk/google');
const { generateText } = require('ai');

function stripMarkdownCodeFences(text = '') {
  return text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_, body) => body || '').trim();
}

function extractJsonObjectByKey(text, key) {
  if (!text) return null;
  const anchor = text.lastIndexOf(`"${key}"`);
  if (anchor === -1) return null;
  let start = text.lastIndexOf('{', anchor);
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  const candidate = text.slice(start, end);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function normalizeActionItem(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const title = raw.trim();
    return title ? { title, owner: null, due: null, ts: null } : null;
  }
  if (typeof raw === 'object') {
    const title = typeof raw.title === 'string' ? raw.title.trim() : String(raw.title ?? '').trim();
    if (!title) return null;
    return {
      title,
      owner: raw.owner ?? null,
      due: raw.due ?? null,
      ts: raw.ts ?? null,
    };
  }
  return null;
}

function fallbackActionsFromText(text) {
  const clean = stripMarkdownCodeFences(text);
  const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const actions = [];
  const bulletRegex = /^(?:[-*•]\s+|\d+\.\s+)(.+)$/;
  for (const line of lines) {
    if (/^\*\*/.test(line)) continue; // headings
    const match = line.match(bulletRegex);
    if (match) {
      actions.push(match[1].trim());
      continue;
    }
  }
  if (!actions.length) {
    const nextStepsIndex = lines.findIndex((line) => /next\s+steps/i.test(line));
    if (nextStepsIndex !== -1) {
      for (let i = nextStepsIndex + 1; i < lines.length; i += 1) {
        const candidate = lines[i];
        if (!candidate || /^\*\*/.test(candidate)) break;
        actions.push(candidate.replace(/^[*-]\s*/, '').trim());
        if (actions.length >= 8) break;
      }
    }
  }
  return actions
    .map((title) => normalizeActionItem(title))
    .filter(Boolean)
    .slice(0, 8);
}

function parseActionsFromContent(content) {
  const clean = stripMarkdownCodeFences(content || '');
  if (!clean) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(clean);
  } catch (error) {
    parsed = extractJsonObjectByKey(clean, 'actions');
  }
  if (parsed && Array.isArray(parsed.actions)) {
    return parsed.actions
      .map((item) => normalizeActionItem(item))
      .filter(Boolean)
      .slice(0, 8);
  }
  return fallbackActionsFromText(clean);
}

function parseKeywordsFromContent(content) {
  const clean = stripMarkdownCodeFences(content || '');
  if (!clean) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(clean);
  } catch (error) {
    parsed = extractJsonObjectByKey(clean, 'keywords');
  }
  if (parsed && Array.isArray(parsed.keywords)) {
    return parsed.keywords
      .map((kw) => String(kw).trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  const keywords = new Set();
  const bulletRegex = /(?:^|\n)\s*(?:[-*•]|\d+\.)\s*([^\n]+)/g;
  let match;
  while ((match = bulletRegex.exec(clean)) && keywords.size < 8) {
    const candidate = match[1].trim();
    if (candidate) keywords.add(candidate);
  }
  if (!keywords.size) {
    clean
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        if (keywords.size < 8) keywords.add(part);
      });
  }
  return Array.from(keywords);
}

function buildContextNote(context) {
  if (!context) return '';
  const parts = [];
  if (context.globalGuidelines) parts.push(String(context.globalGuidelines).trim());
  if (context.classGuidelines) parts.push(String(context.classGuidelines).trim());
  return parts.filter(Boolean).join('\n\n');
}

function buildSummarySystemPrompt(context) {
  const sections = ['You are a concise, structured note-taker.'];
  const note = buildContextNote(context);
  if (note) {
    sections.push(`Follow these guidelines:\n${note}`);
  }
  if (context?.includeActionItems === false) {
    sections.push('Focus on conceptual summaries; action items are handled separately.');
  } else {
    sections.push('Call out any action items or next steps that students should remember.');
  }
  if (context?.emphasiseKeyTerms !== false) {
    sections.push('Emphasise key terms, formulas, or definitions explicitly.');
  }
  return sections.join('\n\n');
}

function buildActionsPrompt(text, context) {
  const note = buildContextNote(context);
  const guideline = note ? `Guidelines:\n${note}\n\n` : '';
  return `${guideline}Extract action items as JSON exactly:
{ "actions": [ { "title": string, "owner": string|null, "due": string|null, "ts": number|null } ] }
Transcript:
${text}`;
}

function buildKeywordsPrompt(text, context) {
  const note = buildContextNote(context);
  const guideline = note ? `Guidelines:\n${note}\n\n` : '';
  return `${guideline}Return JSON { "keywords": [string] } with 3–8 concise keywords:
${text}`;
}

function createProvider(cfg) {
  const p = (cfg && cfg.provider) || process.env.AI_PROVIDER || 'hybrid-gemini';
  switch (p) {
    case 'openai':            return openAIProvider(cfg || {});
    case 'openrouter':        return openRouterProvider(cfg || {});
    case 'gemini':            return geminiProvider(cfg || {});
    case 'local-emb':         return xenovaEmbeddingsProvider();
    case 'hybrid-openai':     return hybridOpenAI(cfg || {});     // OpenAI chat + Xenova emb
    case 'hybrid-openrouter': return hybridOpenRouter(cfg || {}); // OpenRouter chat + Xenova emb
    case 'hybrid-gemini':     return hybridGemini(cfg || {});     // Gemini chat + Xenova emb
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

  const summarize = async (text, context = {}) =>
    (await chat(
      [
        { role: 'system', content: buildSummarySystemPrompt(context) },
        { role: 'user',   content: `Summarize clearly in <=1 short paragraph:\n\n${text}` },
      ],
      { temperature: 0.2 }
    )).trim();

  const extractActions = async (text, context = {}) => {
    if (context?.includeActionItems === false) return [];
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON action items.' },
        { role: 'user',   content: buildActionsPrompt(text, context) }
      ],
      { response_format: { type: 'json_object' }, temperature: 0.0 }
    );
    return parseActionsFromContent(content);
  };

  const keywords = async (text, context = {}) => {
    if (context?.emphasiseKeyTerms === false) return [];
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON keywords.' },
        { role: 'user',   content: buildKeywordsPrompt(text, context) }
      ],
      { response_format: { type: 'json_object' }, temperature: 0.0 }
    );
    return parseKeywordsFromContent(content);
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

  const summarize = async (text, context = {}) =>
    (await chat(
      [
        { role: 'system', content: buildSummarySystemPrompt(context) },
        { role: 'user',   content: `Summarize clearly in <=1 short paragraph:\n\n${text}` },
      ],
      { temperature: 0.2 }
    )).trim();

  const extractActions = async (text, context = {}) => {
    if (context?.includeActionItems === false) return [];
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON action items.' },
        { role: 'user',   content: buildActionsPrompt(text, context) }
      ],
      { temperature: 0.0 }
    );
    return parseActionsFromContent(content);
  };

  const keywords = async (text, context = {}) => {
    if (context?.emphasiseKeyTerms === false) return [];
    const content = await chat(
      [
        { role: 'system', content: 'Return only JSON keywords.' },
        { role: 'user',   content: buildKeywordsPrompt(text, context) }
      ],
      { temperature: 0.0 }
    );
    return parseKeywordsFromContent(content);
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

/* ---------------- Gemini (Vercel AI SDK) ---------------- */
function geminiProvider(cfg) {
  const apiKey = cfg.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = cfg.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('Gemini API key missing');

  // Create Gemini model instance
  const geminiModel = google(model, { apiKey });

  const summarize = async (text, context = {}) => {
    console.log('[GEMINI] Summarizing text length:', text.length);
    try {
      const { text: result } = await generateText({
        model: geminiModel,
        system: buildSummarySystemPrompt(context),
        prompt: `Summarize clearly in ≤1 short paragraph:\n\n${text}`,
        temperature: 0.2
      });
      console.log('[GEMINI] Summary generated successfully, length:', result.length);
      return result.trim();
    } catch (error) {
      console.error('[GEMINI] Summarize error:', error.message);
      throw new Error(`Gemini summarize failed: ${error.message}`);
    }
  };

  const extractActions = async (text, context = {}) => {
    if (context?.includeActionItems === false) return [];
    console.log('[GEMINI] Extracting actions from text length:', text.length);
    try {
      const { text: content } = await generateText({
        model: geminiModel,
        system: 'Return only raw JSON without code blocks or formatting.',
        prompt: buildActionsPrompt(text, context),
        temperature: 0.0
      });
      console.log('[GEMINI] Actions response:', content.substring(0, 200));
      const actions = parseActionsFromContent(content);
      if (!actions.length) {
        console.warn('[GEMINI] Action parsing fell back to heuristics.');
      }
      return actions;
    } catch (error) {
      console.error('[GEMINI] Extract actions error:', error.message);
      return [];
    }
  };

  const keywords = async (text, context = {}) => {
    if (context?.emphasiseKeyTerms === false) return [];
    console.log('[GEMINI] Extracting keywords from text length:', text.length);
    try {
      const { text: content } = await generateText({
        model: geminiModel,
        system: 'Return only raw JSON without code blocks or formatting.',
        prompt: buildKeywordsPrompt(text, context),
        temperature: 0.0
      });
      console.log('[GEMINI] Keywords response:', content.substring(0, 200));
      const keywords = parseKeywordsFromContent(content);
      if (!keywords.length) {
        console.warn('[GEMINI] Keyword parsing fell back to heuristics.');
      }
      return keywords;
    } catch (error) {
      console.error('[GEMINI] Extract keywords error:', error.message);
      return [];
    }
  };

  const embed = async () => { throw new Error('Embeddings not provided by Gemini provider here'); };
  return { summarize, extractActions, keywords, embed };
}

/* ---------------- Hybrids ---------------- */
function hybridOpenAI(cfg)      { return combine(xenovaEmbeddingsProvider(), openAIProvider(cfg)); }
function hybridOpenRouter(cfg)  { return combine(xenovaEmbeddingsProvider(), openRouterProvider(cfg)); }
function hybridGemini(cfg)      { return combine(xenovaEmbeddingsProvider(), geminiProvider(cfg)); }

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
