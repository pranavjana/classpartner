// src/services/ai/aiWorker.js
const { parentPort, workerData } = require('node:worker_threads');
const { createProvider } = require('./providers/providerFactory');

const DEFAULT_GLOBAL_GUIDELINES =
  'Summarise the lecture in clear sections: recap previous material, key concepts, demonstrations, and next steps. Highlight equations or definitions explicitly and list action items.';

// Ensure fetch in worker (Electron on older Node)
if (typeof fetch === 'undefined') {
  globalThis.fetch = require('node-fetch'); // npm i node-fetch@2
}

/* -------------------- STATE (declare FIRST) -------------------- */
const state = {
  // transcript & indexing
  segments: [],                 // { id, text, startMs, endMs }
  vectors: [],                  // Float32Array[] aligned to segments
  normCache: [],                // number[] norms for cosine
  contextSegments: [],          // seeded reference notes for this session
  embedDisabledUntil: 0,        // backoff for embeddings

  // session tracking
  currentSessionId: null,
  currentClassId: null,

  // summarization cadence
  lastSummaryAt: 0,
  summaryWindowMs: workerData?.summaryWindowMs ?? 60_000,
  minSummarizeEveryMs: workerData?.minSummarizeEveryMs ?? 12_000,

  // providers
  provider: null,               // embeddings provider (Xenova)
  llmPrimary: null,             // OpenAI (default)
  llmBackup: null,              // OpenRouter fallback
  llmDisabledUntil: 0,          // backoff for primary LLM
  llmLastThrottleLogAt: 0,

  modelContext: {
    globalGuidelines: DEFAULT_GLOBAL_GUIDELINES,
    includeActionItems: true,
    emphasiseKeyTerms: true,
    classContexts: {},
  },
};

const pendingPrimerRequests = new Map();
const pendingClassSearchRequests = new Map();
const GLOBAL_CONTEXT_CLASS_ID = '__global__';

/* -------------------- HELPERS -------------------- */
function post(type, payload) { parentPort.postMessage({ type, payload }); }
function now() { return Date.now(); }
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function norm(v)  { let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s); }
function cosineSim(a, b, nb) { const na = norm(a); return (na && nb) ? dot(a, b) / (na * nb) : 0; }

function fmtTs(ms) {
  if (ms == null) return '--:--';
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}

function getRollingText() {
  const cutoff = now() - state.summaryWindowMs;
  const recent = state.segments.filter((s) => !s.__context && (s.endMs ?? 0) >= cutoff);
  const fallback = state.segments.filter((s) => !s.__context).slice(-6); // fallback to last ~6
  const chosen = recent.length ? recent : fallback;
  return chosen.map((s) => s.text).join(' ').trim();
}

function buildPromptContext() {
  const ctx = state.modelContext || {};
  const classGuidelinesRaw = state.currentClassId ? ctx.classContexts?.[state.currentClassId] : undefined;
  return {
    globalGuidelines: typeof ctx.globalGuidelines === 'string' ? ctx.globalGuidelines.trim() : '',
    classGuidelines: typeof classGuidelinesRaw === 'string' ? classGuidelinesRaw.trim() : '',
    includeActionItems: ctx.includeActionItems !== false,
    emphasiseKeyTerms: ctx.emphasiseKeyTerms !== false,
  };
}

function resetSessionBuffers() {
  state.segments = [];
  state.vectors = [];
  state.normCache = [];
  state.contextSegments = [];
  state.lastSummaryAt = 0;
}

function buildContextPrimer(maxChars = 1200) {
  if (!state.contextSegments.length) return '';
  const combined = state.contextSegments.map((seg) => seg.text).join('\n\n');
  return combined.slice(0, maxChars);
}

function randomRequestId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2)}`;
}

function requestClassContextPrimer(classId, limit = 5) {
  if (!classId) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const requestId = randomRequestId('primer');
    const timeout = setTimeout(() => {
      pendingPrimerRequests.delete(requestId);
      reject(new Error('Primer request timed out'));
    }, 5000);

    pendingPrimerRequests.set(requestId, { resolve, reject, timeout });
    post('class-context:primer:request', { requestId, classId, limit });
  });
}

function requestClassContextSearch(classId, queryEmbedding, limit = 10, excludeIds = []) {
  if (!classId) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const requestId = randomRequestId('kb');
    const timeout = setTimeout(() => {
      pendingClassSearchRequests.delete(requestId);
      reject(new Error('Class context search timed out'));
    }, 5000);

    pendingClassSearchRequests.set(requestId, { resolve, reject, timeout });
    post('class-context:search:request', {
      requestId,
      classId,
      queryEmbedding: Array.from(queryEmbedding),
      limit,
      excludeIds,
    });
  });
}

async function loadClassContextPrimer(classId) {
  if (!classId) return;
  try {
    const primerSegments = await requestClassContextPrimer(classId, 5);
    primerSegments
      .filter((seg) => seg?.text)
      .forEach((seg) => {
        const text = typeof seg.text === 'string' ? seg.text.trim() : '';
        if (!text) return;
        const id = seg.id || randomRequestId('ctx');
        if (state.contextSegments.some((existing) => existing.id === id)) return;
        const contextSeg = {
          id,
          text,
          __context: true,
          sourceId: seg.sourceId || null,
          classId: seg.classId || classId,
          startMs: -1,
          endMs: -1,
        };
        state.contextSegments.push(contextSeg);
      });
  } catch (error) {
    console.warn('[ClassContext] Failed to load primer:', error.message);
  }
}

/* -------------------- EMBEDDING -------------------- */
async function indexSegment(seg) {
  if (!state.provider?.embed) return null;
  if (now() < state.embedDisabledUntil) return null;

  try {
    const [vec] = await state.provider.embed([seg.text]);
    if (vec) {
      state.vectors.push(vec);
      state.normCache.push(norm(vec));
      return vec; // Return embedding for disk storage
    } else {
      state.vectors.push(null);
      state.normCache.push(0);
      return null;
    }
  } catch (e) {
    const msg = String(e?.message ?? e);
    post('ai:log', { message: 'Embedding failed: ' + msg });
    // Pause embeddings for 10 min on quota/rate issues
    if (/429|quota|rate/i.test(msg)) {
      state.embedDisabledUntil = now() + 10 * 60 * 1000;
      post('ai:log', { message: 'Embeddings paused for 10 minutes.' });
    }
    state.vectors.push(null);
    state.normCache.push(0);
    return null;
  }
}

/* -------------------- LLM CALL WITH FALLBACK -------------------- */
async function llmCall(fnName, ...args) {
  const t = Date.now();
  const canUsePrimary = t >= state.llmDisabledUntil;

  async function call(p) {
    if (!p || typeof p[fnName] !== 'function') throw new Error(`LLM method ${fnName} not available`);
    return p[fnName](...args);
  }

  // 1) Try primary if not on cooldown
  if (canUsePrimary) {
    try {
      return await call(state.llmPrimary);
    } catch (e) {
      const msg = String(e?.message ?? e);
      // If rate/quota/server error — enter cooldown and try backup
      if (/429|quota|rate|5\d\d|unavailable/i.test(msg)) {
        state.llmDisabledUntil = t + 5 * 60 * 1000; // 5 min
        if (t - state.llmLastThrottleLogAt > 10_000) { // log at most every 10s
          state.llmLastThrottleLogAt = t;
          post('ai:log', { message: `LLM primary throttled (${msg.slice(0,140)}). Using backup for 5 min.` });
        }
        if (state.llmBackup) {
          return await call(state.llmBackup);
        }
      }
      // non-throttle error: rethrow
      throw e;
    }
  }

  // 2) Primary on cooldown → use backup only
  if (state.llmBackup) {
    return await call(state.llmBackup);
  }

  // 3) No backup configured → last resort: try primary anyway
  return await call(state.llmPrimary);
}


/* -------------------- SUMMARIZATION LOOP -------------------- */
async function maybeSummarize() {
  const t = Date.now();
  if (t - state.lastSummaryAt < state.minSummarizeEveryMs) return;

  const lectureText = getRollingText();
  const primer = buildContextPrimer();
  const text = primer ? `${primer}\n\n${lectureText}`.trim() : lectureText;
  if (!text) return;
  if (!primer && text.length < 80) return;

  // throttle window starts even if downstream fails
  state.lastSummaryAt = t;

  try {
    const promptContext = buildPromptContext();
    const includeActions = promptContext.includeActionItems !== false;
    const emphasiseTerms = promptContext.emphasiseKeyTerms !== false;

    const [summary, actions, keywords] = await Promise.all([
      llmCall('summarize', text, promptContext),
      includeActions ? llmCall('extractActions', text, promptContext) : Promise.resolve([]),
      emphasiseTerms ? llmCall('keywords', text, promptContext) : Promise.resolve([]),
    ]);
    post('ai:update', {
      summary,
      actions,
      keywords,
      promptContext,
      ts: t,
    });
  } catch (e) {
    post('ai:error', { where: 'maybeSummarize', message: String(e?.message ?? e) });
  }
}


/* -------------------- FAST QUERY (with disk fallback) -------------------- */
async function answerQueryFast(query, opts = {}) {
  const k = opts.k || 6;
  const searchFullHistory =
    typeof opts.searchFullHistory === 'boolean' ? opts.searchFullHistory : true;

  // Try semantic retrieval if we have embed; else keyword fallback
  let qv = null, nq = 0;
  try {
    if (state.provider?.embed) {
      [qv] = await state.provider.embed([query]);
      nq = norm(qv);
    }
  } catch { /* ignore, fallback below */ }

  let hits = [];

  // 1. Search in-memory first (fast, recent segments)
  if (qv && nq) {
    for (let i = 0; i < state.vectors.length; i++) {
      const v = state.vectors[i]; const nv = state.normCache[i];
      if (!v || !nv) continue;
      const score = cosineSim(qv, v, nv);
      hits.push([score, i, 'memory']);
    }
    hits.sort((a, b) => b[0] - a[0]);
  } else {
    // Keyword fallback
    const Q = query.toLowerCase();
    for (let i = 0; i < state.segments.length; i++) {
      const t = state.segments[i].text.toLowerCase();
      const score = t.includes(Q) ? (Q.length / (t.length + 1)) : 0;
      if (score > 0) hits.push([score, i, 'memory']);
    }
    hits.sort((a, b) => b[0] - a[0]);
  }

  const memoryHits = hits.slice(0, k);

  // 2. If searching full history OR memory results are insufficient, request disk search
  let diskHits = [];
  if (searchFullHistory && state.currentSessionId && qv) {
    // Request disk search from main process
    try {
      const memoryIds = state.segments.map(s => s.id);
      const diskResults = await requestDiskSearch(state.currentSessionId, qv, k, memoryIds);
      diskHits = diskResults.map(r => [r.score, r.segment, 'disk']);
    } catch (e) {
      post('ai:log', { message: `Disk search failed: ${e.message}` });
    }
  }

  let kbHits = [];
  if (qv) {
    const searchTargets = new Set();
    if (state.currentClassId) searchTargets.add(state.currentClassId);
    searchTargets.add(GLOBAL_CONTEXT_CLASS_ID);
    const memoryIds = state.segments.map((s) => s.id);

    for (const classId of searchTargets) {
      try {
        const kbResults = await requestClassContextSearch(classId, qv, Math.max(k, 8), memoryIds);
        kbResults.forEach((r) => {
          kbHits.push([
            r.score,
            { ...r.segment, __context: true, classId },
            classId === GLOBAL_CONTEXT_CLASS_ID ? 'global' : 'class',
          ]);
        });
      } catch (e) {
        post('ai:log', { message: `Class context search failed (${classId}): ${e.message}` });
      }
    }
  }

  // 3. Merge and rank results
  const allHits = [...memoryHits, ...diskHits, ...kbHits];
  allHits.sort((a, b) => b[0] - a[0]);
  const topHits = allHits.slice(0, k);

  // 4. Format context
  const includedIds = new Set();
  const ctxLines = topHits
    .map(([score, item, source]) => {
      const seg = source === 'memory' ? state.segments[item] : item;
      if (!seg || !seg.text) return null;
      includedIds.add(seg.id);
      const sourceLabel =
        seg.__context
          ? seg.classId === GLOBAL_CONTEXT_CLASS_ID
            ? '[Global Context]'
            : '[Class Context]'
          : `[${fmtTs(seg.startMs)}-${fmtTs(seg.endMs)}]`;
      const origin = seg.metadata?.source ? ` (${seg.metadata.source})` : '';
      return `• ${sourceLabel} ${seg.text}${origin}`;
    })
    .filter(Boolean);

  const extraContextSnippets = [];
  const queryLower = query.toLowerCase();
  for (const seg of state.contextSegments) {
    if (!seg?.text) continue;
    if (includedIds.has(seg.id)) continue;
    const sourceLabel = seg.classId === GLOBAL_CONTEXT_CLASS_ID ? '[Global Context]' : '[Class Context]';
    const origin = seg.metadata?.source ? ` (${seg.metadata.source})` : '';
    if (qv && nq) {
      extraContextSnippets.push(`• ${sourceLabel} ${seg.text}${origin}`);
      includedIds.add(seg.id);
    } else if (queryLower && seg.text.toLowerCase().includes(queryLower)) {
      extraContextSnippets.push(`• ${sourceLabel} ${seg.text}${origin}`);
      includedIds.add(seg.id);
    }
    if (extraContextSnippets.length >= Math.max(3, Math.ceil(k / 2))) break;
  }

  if (!extraContextSnippets.length && state.contextSegments.length) {
    const primer = state.contextSegments.slice(0, Math.min(3, state.contextSegments.length));
    primer.forEach((seg) => {
      if (!seg?.text) return;
      if (includedIds.has(seg.id)) return;
      const sourceLabel = seg.classId === GLOBAL_CONTEXT_CLASS_ID ? '[Global Context]' : '[Class Context]';
      const origin = seg.metadata?.source ? ` (${seg.metadata.source})` : '';
      extraContextSnippets.push(`• ${sourceLabel} ${seg.text}${origin}`);
      includedIds.add(seg.id);
    });
  }

  const combinedSnippets = [...ctxLines, ...extraContextSnippets].filter(Boolean).join('\n');

  const cached = {
    rollingSummary: getRollingText().slice(-800),
    searchedFullHistory: searchFullHistory,
    memoryHits: memoryHits.length,
    diskHits: diskHits.length,
    classHits: kbHits.length,
  };

  if (opts.mode === 'snippets') return { mode: 'snippets', snippets: combinedSnippets, cached };

  try {
    const prompt = `You are an assistant answering based on class snippets.
Query: ${query}
Snippets:
${combinedSnippets}

Answer succinctly. If insufficient context, say so.`;
    const answer = await llmCall('summarize', prompt, buildPromptContext()); // cheap single-pass
    return { mode: 'qa', answer, snippets: combinedSnippets, cached };
  } catch (e) {
    return { mode: 'snippets', snippets: combinedSnippets, cached, error: String(e?.message ?? e) };
  }
}

// Helper to request disk search from main process
function requestDiskSearch(sessionId, queryEmbedding, limit, excludeIds) {
  return new Promise((resolve, reject) => {
    const requestId = 'disk_' + Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => reject(new Error('Disk search timeout')), 5000);

    const handler = (msg) => {
      if (msg?.type === 'disk-search:result' && msg?.payload?.requestId === requestId) {
        clearTimeout(timeout);
        parentPort.off('message', handler);
        resolve(msg.payload.results || []);
      }
    };

    parentPort.on('message', handler);
    post('disk-search:request', {
      requestId,
      sessionId,
      queryEmbedding: Array.from(queryEmbedding),
      limit,
      excludeIds
    });
  });
}

/* -------------------- MESSAGE HANDLER -------------------- */
parentPort.on('message', async (msg) => {
  try {
    if (msg?.type === 'provider:set') {
  const cfg  = msg.payload || {};
  const mode = cfg.provider || process.env.AI_PROVIDER || 'hybrid-gemini';

  // Build clean configs for each LLM
  const geminiCfg = {
    provider: 'gemini',
    apiKey: cfg.geminiApiKey,
    model: cfg.geminiModel || 'gemini-2.5-flash'
  };

  const openaiCfg = {
    provider: 'openai',
    apiKey:   cfg.openaiApiKey,          // <-- from index.js setProviderConfig
    baseUrl:  cfg.openaiBaseUrl,         // optional (defaults to https://api.openai.com/v1)
    model:    cfg.openaiModel            // optional (defaults in providerFactory)
  };

  const openrouterCfg = {
    provider: 'openrouter',
    apiKey:   cfg.openrouterApiKey,      // <-- NOTE all-lowercase 'openrouterApiKey'
    baseUrl:  cfg.baseUrl,               // e.g. https://openrouter.ai/api/v1
    model:    cfg.model,                 // e.g. meta/llama-3.1-8b-instruct
    referer:  cfg.referer,
    title:    cfg.title
  };

  if (mode === 'hybrid-gemini') {
    state.llmPrimary = createProvider(geminiCfg);
    state.llmBackup  = createProvider(openaiCfg);
    state.provider   = createProvider({ provider: 'local-emb' }); // Xenova embeddings
  } else if (mode === 'hybrid-openai') {
    state.llmPrimary = createProvider(openaiCfg);
    state.llmBackup  = createProvider(openrouterCfg);
    state.provider   = createProvider({ provider: 'local-emb' }); // Xenova embeddings
  } else if (mode === 'hybrid-openrouter') {
    state.llmPrimary = createProvider(openrouterCfg);
    state.llmBackup  = createProvider(openaiCfg);
    state.provider   = createProvider({ provider: 'local-emb' });
  } else if (mode === 'gemini') {
    // Pure Gemini mode
    const p = createProvider({ provider: 'gemini', apiKey: geminiCfg.apiKey, model: geminiCfg.model });
    state.llmPrimary = p; state.llmBackup = null; state.provider = p;
  } else {
    // single provider (not recommended, but safe fallback)
    const p = createProvider({ provider: mode, apiKey: openaiCfg.apiKey || openrouterCfg.apiKey });
    state.llmPrimary = p; state.llmBackup = null; state.provider = p;
  }

  // Determine primary provider name for logging
  let primaryName = 'unknown';
  let backupName = 'none';
  
  if (mode === 'hybrid-gemini') {
    primaryName = 'gemini';
    backupName = 'openai';
  } else if (mode === 'hybrid-openai') {
    primaryName = 'openai';
    backupName = 'openrouter';
  } else if (mode === 'hybrid-openrouter') {
    primaryName = 'openrouter';
    backupName = 'openai';
  } else if (mode === 'gemini') {
    primaryName = 'gemini';
  } else if (mode.includes('openai')) {
    primaryName = 'openai';
  } else if (mode.includes('openrouter')) {
    primaryName = 'openrouter';
  }

  post('ai:log', {
    message: `LLM primary=${primaryName}; backup=${backupName}; embeddings=Xenova`
  });
  post('ai:log', { message: `cfg keys -> gemini:${!!cfg.geminiApiKey} openai:${!!cfg.openaiApiKey} openrouter:${!!cfg.openrouterApiKey}` });

  return;
}

    if (msg?.type === 'debug:forceBackup') { state.llmDisabledUntil = Date.now() + 5*60*1000; post('ai:log',{message:'Primary LLM forced into cooldown'}); return; }

    if (msg?.type === 'context:add') {
      const { requestId, classId, sourceId, segments } = msg.payload || {};
      try {
        if (!segments || !segments.length) {
          throw new Error('No segments provided for context ingestion');
        }
        const texts = segments.map((seg) => seg.text || '');
        let vectors = [];
        if (state.provider?.embed) {
          try {
            vectors = await state.provider.embed(texts);
          } catch (embedError) {
            console.warn('[ClassContext] Embedding provider failed, storing without embeddings:', embedError);
            vectors = [];
          }
        }
        const prepared = segments.map((seg, idx) => {
          const vector = vectors?.[idx];
          return {
            id: seg.id,
            orderIndex: seg.orderIndex ?? idx,
            text: seg.text,
            metadata: seg.metadata || null,
            embedding: vector ? Array.from(vector) : null,
          };
        });
        post('context:save', { requestId, classId, sourceId, segments: prepared });
      } catch (error) {
        post('context:save', {
          requestId,
          classId,
          sourceId,
          error: String(error?.message ?? error),
        });
      }
      return;
    }


    if (msg?.type === 'model-context:set') {
      const incoming = msg.payload || {};
      state.modelContext = {
        globalGuidelines:
          typeof incoming.globalGuidelines === 'string'
            ? incoming.globalGuidelines
            : state.modelContext.globalGuidelines,
        includeActionItems:
          typeof incoming.includeActionItems === 'boolean'
            ? incoming.includeActionItems
            : state.modelContext.includeActionItems,
        emphasiseKeyTerms:
          typeof incoming.emphasiseKeyTerms === 'boolean'
            ? incoming.emphasiseKeyTerms
            : state.modelContext.emphasiseKeyTerms,
        classContexts:
          incoming.classContexts && typeof incoming.classContexts === 'object'
            ? incoming.classContexts
            : state.modelContext.classContexts,
      };
      post('ai:log', { message: 'Model context updated' });
      return;
    }

    if (msg?.type === 'class-context:primer:result') {
      const { requestId, segments } = msg.payload || {};
      const pending = pendingPrimerRequests.get(requestId);
      if (pending) {
        pendingPrimerRequests.delete(requestId);
        clearTimeout(pending.timeout);
        pending.resolve(segments || []);
      }
      return;
    }

    if (msg?.type === 'class-context:search:result') {
      const { requestId, results } = msg.payload || {};
      const pending = pendingClassSearchRequests.get(requestId);
      if (pending) {
        pendingClassSearchRequests.delete(requestId);
        clearTimeout(pending.timeout);
        pending.resolve(results || []);
      }
      return;
    }

    if (msg?.type === 'session:start') {
      resetSessionBuffers();
      state.currentSessionId = msg.payload.sessionId;
      state.currentClassId = msg.payload.classId || null;
      await loadClassContextPrimer(GLOBAL_CONTEXT_CLASS_ID);
      if (state.currentClassId) {
        await loadClassContextPrimer(state.currentClassId);
      }
      post('ai:log', {
        message: `Session started: ${state.currentSessionId}; contextChunks=${state.contextSegments.length}`,
      });
      return;
    }

    if (msg?.type === 'session:end') {
      post('ai:log', { message: `Session ended: ${state.currentSessionId}` });
      resetSessionBuffers();
      state.currentSessionId = null;
      state.currentClassId = null;
      return;
    }

    if (msg?.type === 'segment') {
      const seg = msg.payload;
      if (seg?.text) {
        // Normalize timestamps (treat tiny numbers as "now")
        const MIN_MS = 946684800000; // Jan 1, 2000
        if (typeof seg.endMs !== 'number' || seg.endMs < MIN_MS) seg.endMs = now();
        if (typeof seg.startMs !== 'number' || seg.startMs < MIN_MS) seg.startMs = seg.endMs - 2000;

        // Store segment in memory
        state.segments.push(seg);
        const contextCount = state.contextSegments.length;
        const maxLectureSegments = 2000;
        const lectureCount = state.segments.length - contextCount;
        if (lectureCount > maxLectureSegments) {
          const drop = lectureCount - maxLectureSegments;
          state.segments.splice(contextCount, drop);
          state.vectors.splice(contextCount, drop);
          state.normCache.splice(contextCount, drop);
        }

        // Background: embed & maybe summarize
        const embedding = await indexSegment(seg);

        // Send segment + embedding to main for disk storage
        if (embedding && state.currentSessionId) {
          post('segment:save', {
            segment: { ...seg, sessionId: state.currentSessionId },
            embedding: Array.from(embedding)
          });
        }

        await maybeSummarize();
      }
      return;
    }

    if (msg?.type === 'flush') {
      await maybeSummarize();
      return;
    }

    if (msg?.type === 'query') {
      const { id, query, opts } = msg.payload;
      const result = await answerQueryFast(query, opts);
      post('ai:query:result', { id, ...result });
      return;
    }
  } catch (e) {
    post('ai:error', { where: 'onmessage', messages: String(e?.message ?? e) });
  }
});
