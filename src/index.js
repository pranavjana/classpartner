// src/index.js
const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const Store = require('electron-store');
require('dotenv').config();

const DeepgramService = require('../src/services/deepGram.js');        // ⬅ adjust if your services/ live elsewhere
const { AIPipeline } = require('../src/services/ai/pipeline');          // ⬅ adjust if needed
const TranscriptStorage = require('../src/services/transcriptStorage'); // NEW: SQLite storage

const store = new Store();
const MODEL_CONTEXT_KEY = 'modelContext';
const isDev = !app.isPackaged;
const PRELOAD = path.join(__dirname, 'preload.js');


let overlayWindow = null;    // frameless always-on-top widget
let dashboardWindow = null;  // full window for Next dashboard

let deepgramService = null;
let aiPipeline = null;
let transcriptStorage = null; // NEW: Storage service
let currentSessionId = null;  // NEW: Track current recording session
let currentSessionMeta = { classId: null, recordId: null };

// ---------- helpers
function sendToAll(channel, payload) {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(channel, payload);
  if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.webContents.send(channel, payload);
}
function cryptoRandomId() {
  return 'seg_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const pendingContextIngest = new Map();

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizeContextText(text) {
  return typeof text === 'string'
    ? text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim()
    : '';
}

function splitIntoSentences(paragraph) {
  if (!paragraph) return [];
  const cleaned = paragraph.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+|\S+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [cleaned];
}

function chunkClassContextText(text, options = {}) {
  const maxChars = options.maxChars ?? 900;
  const minChars = options.minChars ?? 300;
  const overlapSentences = options.overlapSentences ?? 2;

  const normalized = normalizeContextText(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const sentences = [];
  paragraphs.forEach((paragraph) => {
    const parts = splitIntoSentences(paragraph);
    if (parts.length === 0) return;
    parts.forEach((part) => sentences.push(part));
  });

  const chunks = [];
  let currentSentences = [];

  const joinSentences = (arr) => arr.join(' ').replace(/\s+/g, ' ').trim();
  const pushChunk = (arr) => {
    const joined = joinSentences(arr);
    if (joined) chunks.push(joined);
  };

  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) continue;

    if (clean.length > maxChars) {
      const words = clean.split(/\s+/);
      let buffer = [];
      for (const word of words) {
        const candidate = buffer.length ? `${buffer.join(' ')} ${word}` : word;
        if (candidate.length > maxChars && buffer.length) {
          pushChunk(buffer);
          buffer = overlapSentences ? buffer.slice(-overlapSentences) : [];
          if (buffer.length) {
            const fallback = joinSentences(buffer);
            if (fallback.length > maxChars) buffer = [];
          }
        }
        buffer.push(word);
      }
      if (buffer.length) {
        const joined = buffer.join(' ');
        if (joined.length > maxChars) {
          pushChunk([joined]);
        } else {
          if (joinSentences([...currentSentences, joined]).length > maxChars && joinSentences(currentSentences).length >= minChars) {
            pushChunk(currentSentences);
            currentSentences = overlapSentences ? currentSentences.slice(-overlapSentences) : [];
          }
          currentSentences.push(joined);
        }
      }
      continue;
    }

    const candidate = joinSentences([...currentSentences, clean]);
    if (candidate.length > maxChars && joinSentences(currentSentences).length >= minChars) {
      pushChunk(currentSentences);
      currentSentences = overlapSentences ? currentSentences.slice(-overlapSentences) : [];
    }
    currentSentences.push(clean);
  }

  if (currentSentences.length) {
    pushChunk(currentSentences);
  }

  return chunks;
}

function generateContextSourceId() {
  return `ctxsrc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function formatActionItemPayload(item) {
  if (!item) return '';
  if (typeof item === 'string') {
    return item.trim();
  }
  if (typeof item === 'object') {
    const parts = [];
    if (typeof item.title === 'string' && item.title.trim()) parts.push(item.title.trim());
    if (typeof item.owner === 'string' && item.owner.trim()) parts.push(`@${item.owner.trim()}`);
    if (typeof item.due === 'string' && item.due.trim()) parts.push(`(due ${item.due.trim()})`);
    if (parts.length) return parts.join(' ');
  }
  return '';
}

function persistAiAnalysis(payload) {
  try {
    if (!payload || !currentSessionMeta?.recordId) return;
    ensureTranscriptStorage();
    const recordId = currentSessionMeta.recordId;
    const existing =
      transcriptStorage.getTranscriptionRecord(recordId) || {
        id: recordId,
        sessionId: currentSessionId,
        classId: currentSessionMeta.classId,
        title: recordId,
        createdAt: Date.now(),
        status: 'in-progress',
      };

    const summary =
      typeof payload.summary === 'string' && payload.summary.trim().length
        ? payload.summary.trim()
        : existing.summary ?? null;

    let keyPoints = existing.keyPoints ?? null;
    if (Array.isArray(payload.keywords)) {
      keyPoints = payload.keywords.map((kw) => String(kw).trim()).filter(Boolean);
    }

    let actionItems = existing.actionItems ?? null;
    if (Array.isArray(payload.actions)) {
      const formatted = payload.actions
        .map((item) => formatActionItemPayload(item))
        .filter((text) => text && text.length);
      actionItems = formatted;
    }

    const updatePayload = {
      ...existing,
      summary,
      keyPoints,
      actionItems,
    };

    transcriptStorage.upsertTranscriptionRecord(updatePayload);
    sendToAll('transcription-record:update', {
      id: updatePayload.id,
      summary: updatePayload.summary,
      keyPoints: updatePayload.keyPoints,
      actionItems: updatePayload.actionItems,
    });
  } catch (error) {
    console.error('[AI ANALYSIS] Failed to persist transcription analysis:', error);
  }
}

let docAnalysisProvider = null;
let docAnalysisBusy = false;

function ensureDocAnalysisProvider() {
  if (docAnalysisProvider) return docAnalysisProvider;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[AI DOC] OPENAI_API_KEY not set; cannot analyse documents with OpenAI.');
    return null;
  }
  try {
    docAnalysisProvider = createProvider({
      provider: 'openai',
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  } catch (error) {
    console.error('[AI DOC] Failed to initialise OpenAI provider', error);
    docAnalysisProvider = null;
  }
  return docAnalysisProvider;
}

// ---------- dashboard window (Next UI)
function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) return dashboardWindow;

  const saved = store.get('dashboardBounds', { width: 1280, height: 800 });
  dashboardWindow = new BrowserWindow({
    ...saved,
    title: 'Classpartner',
    backgroundColor: '#0b0b0b',
    show: false,
    webPreferences: {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    },
  }); 

  if (isDev && (process.env.RENDERER_URL || '').startsWith('http')) {
    dashboardWindow.loadURL(process.env.RENDERER_URL); // http://localhost:3001
  } else {
    // PRODUCTION: load exported dashboard
    const indexFile = path.join(__dirname, '..', 'apps', 'dashboard', 'out', 'index.html');
    dashboardWindow.loadFile(indexFile);
  }

  dashboardWindow.once('ready-to-show', () => dashboardWindow.show());
  dashboardWindow.on('resized', () => store.set('dashboardBounds', dashboardWindow.getBounds()));
  dashboardWindow.on('moved',   () => store.set('dashboardBounds', dashboardWindow.getBounds()));
  dashboardWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
  return dashboardWindow;
}

// ---------- overlay window (your existing widget)
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const savedBounds = store.get('overlayBounds', {
    x: screenWidth - 420,
    y: 20,
    width: 400,
    height: 1000,
  });

  overlayWindow = new BrowserWindow({
    ...savedBounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD,
    },
  });

  // If your overlay HTML is NOT in src/, change this path accordingly.
  overlayWindow.loadFile(path.join(__dirname, 'index.html'));

  overlayWindow.on('moved', () => store.set('overlayBounds', overlayWindow.getBounds()));
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show();
    overlayWindow.setOpacity(0);
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.1;
      overlayWindow.setOpacity(opacity);
      if (opacity >= 1) clearInterval(fadeIn);
    }, 30);
  });
  overlayWindow.on('closed', () => { overlayWindow = null; });
  return overlayWindow;
}

// ---------- AI + Deepgram + Storage
function ensureTranscriptStorage() {
  if (!transcriptStorage) {
    transcriptStorage = new TranscriptStorage();
  }
  return transcriptStorage;
}

function getModelContextSettings() {
  const stored = store.get(MODEL_CONTEXT_KEY);
  if (stored && typeof stored === 'object') {
    return stored;
  }
  return {
    globalGuidelines:
      'Summarise the lecture in clear sections: recap previous material, key concepts, demonstrations, and next steps. Highlight equations or definitions explicitly and list action items.',
    includeActionItems: true,
    emphasiseKeyTerms: true,
    classContexts: {},
  };
}

function ensureAiPipeline() {
  if (aiPipeline) return;
  aiPipeline = new AIPipeline({
    summaryWindowMs: Number(process.env.AI_SUMMARY_WINDOW_MS || 60_000),
    minSummarizeEveryMs: Number(process.env.AI_MIN_SUMMARIZE_EVERY_MS || 45_000),
  });

  aiPipeline.setProviderConfig({
    provider: process.env.AI_PROVIDER || 'hybrid-gemini',
    geminiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE,
    model: process.env.OPENROUTER_MODEL,
    referer: process.env.OPENROUTER_REFERER || 'http://localhost',
    title: process.env.OPENROUTER_TITLE || 'Classroom Assistant',
  });

  aiPipeline.on('update', (payload) => {
    sendToAll('ai:update', payload);
    persistAiAnalysis(payload);
  });
  aiPipeline.on('log',    (payload) => { console.log('[AI PIPELINE][log]', payload); sendToAll('ai:log', payload); });
  aiPipeline.on('error',  (e) => sendToAll('ai:error', { message: String(e?.message ?? e) }));

  // NEW: Listen for segments to save to disk
  aiPipeline.worker.on('message', (msg) => {
    if (msg?.type === 'segment:save') {
      const { segment, embedding } = msg.payload;
      ensureTranscriptStorage();
      if (transcriptStorage && segment) {
        try {
          const embeddingArray = embedding ? new Float32Array(embedding) : null;
          transcriptStorage.saveSegment(segment, embeddingArray);
        } catch (e) {
          console.error('[STORAGE] Failed to save segment:', e);
        }
      }
    }

    // Handle disk search requests from worker
    if (msg?.type === 'disk-search:request') {
      const { requestId, sessionId, queryEmbedding, limit, excludeIds } = msg.payload;
      try {
        ensureTranscriptStorage();
        const qVec = new Float32Array(queryEmbedding);
        const results = transcriptStorage.searchSimilar(sessionId, qVec, limit, excludeIds);
        aiPipeline.worker.postMessage({
          type: 'disk-search:result',
          payload: { requestId, results }
        });
      } catch (e) {
        console.error('[STORAGE] Disk search failed:', e);
        aiPipeline.worker.postMessage({
          type: 'disk-search:result',
          payload: { requestId, results: [] }
        });
      }
    }

    if (msg?.type === 'context:save') {
      const { requestId, classId, sourceId, segments, error } = msg.payload || {};
      const pending = pendingContextIngest.get(requestId);
      if (!pending) return;
      pendingContextIngest.delete(requestId);
      clearTimeout(pending.timeout);

      ensureTranscriptStorage();
      if (error) {
        console.error('[ClassContext] Failed to embed context segments:', error);
        try {
          transcriptStorage.deleteClassContextSource(sourceId);
        } catch (err) {
          console.warn('[ClassContext] Cleanup after failure failed:', err);
        }
        pending.reject(new Error(error));
        return;
      }

      try {
        const prepared = (segments || []).map((seg) => ({
          id: seg.id,
          orderIndex: seg.orderIndex ?? 0,
          text: seg.text,
          metadata: seg.metadata || null,
          embedding: Array.isArray(seg.embedding) ? new Float32Array(seg.embedding) : null,
        }));
        transcriptStorage.saveClassContextSegments(sourceId, classId, prepared);
        pending.resolve({ segmentsSaved: prepared.length });
      } catch (err) {
        console.error('[ClassContext] Failed to persist context segments:', err);
        try {
          transcriptStorage.deleteClassContextSource(sourceId);
        } catch (cleanupErr) {
          console.warn('[ClassContext] Cleanup after persist failure failed:', cleanupErr);
        }
        pending.reject(err);
      }
      return;
    }

    if (msg?.type === 'class-context:primer:request') {
      const { requestId, classId, limit } = msg.payload || {};
      ensureTranscriptStorage();
      let segments = [];
      if (classId) {
        try {
          segments = transcriptStorage.getClassContextPrimer(classId, limit ?? 5);
        } catch (error) {
          console.error('[ClassContext] Primer fetch failed:', error);
        }
      }
      aiPipeline.worker.postMessage({
        type: 'class-context:primer:result',
        payload: { requestId, classId, segments }
      });
      return;
    }

    if (msg?.type === 'class-context:search:request') {
      const { requestId, classId, queryEmbedding, limit, excludeIds } = msg.payload || {};
      ensureTranscriptStorage();
      let results = [];
      if (classId && Array.isArray(queryEmbedding)) {
        try {
          const qVec = new Float32Array(queryEmbedding);
          results = transcriptStorage.searchSimilarClass(classId, qVec, limit ?? 6, excludeIds ?? []);
        } catch (error) {
          console.error('[ClassContext] Search failed:', error);
          results = [];
        }
      }
      aiPipeline.worker.postMessage({
        type: 'class-context:search:result',
        payload: { requestId, results }
      });
      return;
    }
  });

  aiPipeline.setModelContext(getModelContextSettings());
}

function setupDeepgramEventHandlers() {
  if (!deepgramService) return;
  deepgramService.on('transcription', (data) => {
    sendToAll('transcription-data', data);
    try {
      const isFinal =
        data?.is_final === true ||
        data?.type === 'final' ||
        (data?.channel?.alternatives?.[0]?.transcript && data?.speech_final === true);

      const text =
        data?.text ||
        data?.channel?.alternatives?.[0]?.transcript ||
        data?.transcript ||
        '';

      if (aiPipeline && isFinal && text.trim()) {
        aiPipeline.enqueueSegment({
          id: data?.id || cryptoRandomId(),
          text: text.trim(),
          startMs: data?.startMs ?? null,
          endMs: data?.endMs ?? Date.now(),
        });
      }
    } catch (e) {
      sendToAll('ai:error', { message: `AI enqueue error: ${String(e?.message ?? e)}` });
    }
  });
  deepgramService.on('status', (status) => sendToAll('transcription-status', status));
  deepgramService.on('error',  (err)   => sendToAll('transcription-error', { message: err.message, type: 'deepgram-error' }));
  deepgramService.on('connected',     () => sendToAll('transcription-connected'));
  deepgramService.on('disconnected',  () => { sendToAll('transcription-disconnected'); aiPipeline && aiPipeline.flush(); });
  deepgramService.on('quality-change', (q) => sendToAll('connection-quality-change', q));
}

// ---------- IPC
function setupIpcHandlers() {
  // Window controls for overlay (unchanged)
  ipcMain.handle('window-close', () => { overlayWindow?.close(); });
  ipcMain.handle('window-minimize', () => { overlayWindow?.minimize(); });
  ipcMain.handle('toggle-always-on-top', () => {
    if (!overlayWindow) return false;
    const current = overlayWindow.isAlwaysOnTop();
    overlayWindow.setAlwaysOnTop(!current);
    return !current;
  });
  ipcMain.handle('is-always-on-top', () => (overlayWindow ? overlayWindow.isAlwaysOnTop() : false));
  ipcMain.handle('get-window-bounds', () => (overlayWindow ? overlayWindow.getBounds() : null));
  ipcMain.on('window-resize', (_e, w, h) => overlayWindow && overlayWindow.setSize(Math.round(w), Math.round(h)));

  // From Dashboard: open/toggle overlay
  ipcMain.handle('overlay:show', () => {
    const w = createOverlayWindow();
    w.show(); w.focus();
  });
  ipcMain.handle('overlay:toggle', () => {
    if (!overlayWindow) return createOverlayWindow();
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else overlayWindow.show();
  });

  // Open/focus Dashboard (if you need to call from overlay)
  ipcMain.handle('dashboard:open', () => {
    const w = createDashboardWindow();
    if (w.isMinimized()) w.restore();
    w.show(); w.focus();
  });

  // Dev tools
  ipcMain.handle('open-dev-tools', () => {
    if (dashboardWindow) dashboardWindow.webContents.openDevTools({ mode: 'detach' });
    else if (overlayWindow) overlayWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Settings / version
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-settings', () => store.store);
  ipcMain.handle('update-settings', (_e, settings) => {
    Object.keys(settings).forEach((k) => store.set(k, settings[k]));
    return store.store;
  });

  // Manual enqueue
  ipcMain.on('transcript:final', (_evt, seg) => {
    if (aiPipeline && seg?.text) {
      aiPipeline.enqueueSegment(seg);
      sendToAll('ai:log', { message: 'enqueued segment', textPreview: seg.text.slice(0, 60) });
    }
  });

  // Transcription lifecycle
  ipcMain.handle('start-transcription', async (_event, metadata = {}) => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) return { success: false, error: 'Deepgram API key not found. Add DEEPGRAM_API_KEY to .env' };

      if (!deepgramService) { deepgramService = new DeepgramService(apiKey); setupDeepgramEventHandlers(); }
      ensureTranscriptStorage(); // NEW: Initialize storage
      ensureAiPipeline();

      // NEW: Create session
      const existingClassId = currentSessionMeta?.classId ?? null;
      const existingRecordId = currentSessionMeta?.recordId ?? null;
      const classId = typeof metadata?.classId === 'string' ? metadata.classId : existingClassId;
      const recordId = typeof metadata?.recordId === 'string' ? metadata.recordId : existingRecordId;

      currentSessionId = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      currentSessionMeta = {
        classId: classId ?? null,
        recordId: recordId ?? null,
      };
      transcriptStorage.createSession(currentSessionId);

      // NEW: Notify AI worker of session start
      aiPipeline.worker.postMessage({
        type: 'session:start',
        payload: {
          sessionId: currentSessionId,
          classId: currentSessionMeta.classId,
        },
      });

      await deepgramService.connect();
      console.log('[MAIN] Transcription started with session:', currentSessionId);

      return { success: true, message: 'Transcription started', sessionId: currentSessionId };
    } catch (error) {
      return { success: false, error: `Failed to start transcription: ${error.message}` };
    }
  });

  ipcMain.handle('stop-transcription', () => {
    try {
      deepgramService?.disconnect();
      aiPipeline?.flush();

      // NEW: End session
      if (currentSessionId && transcriptStorage) {
        const sessionStats = transcriptStorage.endSession(currentSessionId);
        console.log('[MAIN] Session ended:', currentSessionId, sessionStats);

        // Notify AI worker
        if (aiPipeline) {
          aiPipeline.worker.postMessage({ type: 'session:end' });
        }

        const returnSessionId = currentSessionId;
        currentSessionId = null;
        currentSessionMeta = { classId: null, recordId: null };
        return { success: true, message: 'Transcription stopped', sessionId: returnSessionId, stats: sessionStats };
      }

      return { success: true, message: 'Transcription stopped' };
    } catch (error) {
      return { success: false, error: `Failed to stop transcription: ${error.message}` };
    }
  });

  ipcMain.handle('send-audio-data', async (_e, audioArray) => {
    try {
      if (deepgramService?.isConnectedToDeepgram()) {
        const buffer = new Uint8Array(audioArray);
        const success = deepgramService.sendAudio(buffer);
        return { success };
      }
      return { success: false, error: 'Not connected to Deepgram' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-transcription-status', () => {
    if (deepgramService) {
      return { connected: deepgramService.isConnectedToDeepgram(), status: deepgramService.getConnectionStatus() };
    }
    return { connected: false, status: 'disconnected' };
  });

  ipcMain.handle('get-ai-availability', () => {
    const configured = Boolean(process.env.AI_PROVIDER && process.env.OPENAI_API_KEY);
    return { configured, provider: process.env.AI_PROVIDER || null, model: process.env.OPENAI_MODEL || null };
  });

  ipcMain.handle('ai:force-backup', () => { aiPipeline?.worker?.postMessage?.({ type: 'debug:forceBackup' }); });
  ipcMain.handle('ai:query', async (_evt, { query, opts }) => {
    if (!aiPipeline) return { success: false, error: 'AI pipeline not ready' };
    try { const result = await aiPipeline.query(query, opts); return { success: true, ...result }; }
    catch (e) { return { success: false, error: String(e?.message ?? e) }; }
  });

  ipcMain.handle('ai:doc-analyse', async (_evt, payload = {}) => {
    try {
      const provider = ensureDocAnalysisProvider();
      if (!provider?.summarize) {
        throw new Error('OpenAI provider unavailable for document analysis');
      }
      if (docAnalysisBusy) {
        return { success: false, busy: true, error: 'Document analysis currently running' };
      }
      docAnalysisBusy = true;
      try {
        const mode = typeof payload.type === 'string' ? payload.type : 'summary';
        const instructions = typeof payload.instructions === 'string' ? payload.instructions : '';

        if (mode === 'vision') {
          const dataUrl = typeof payload.dataUrl === 'string' ? payload.dataUrl : '';
          const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
          if (!dataUrl) throw new Error('Image data missing');
          const requestText = `${instructions ? `${instructions}\n\n` : ''}${prompt}\n\nImage data (base64): ${dataUrl}`;
          const content = await provider.summarize(requestText, {});
          return { success: true, content };
        }

        const rawText = typeof payload.text === 'string' ? payload.text : '';
        if (!rawText.trim()) throw new Error('No text provided for analysis');
        const truncated = rawText.length > 48000 ? `${rawText.slice(0, 48000)}…` : rawText;
        const context = {
          instructions,
          fileName: payload.fileName,
        };
        const content = await provider.summarize(truncated, context);
        return { success: true, content };
      } finally {
        docAnalysisBusy = false;
      }
    } catch (error) {
      return { success: false, error: String(error?.message ?? error) };
    }
  });

  ipcMain.handle('ai:selftest', async () => {
    if (!aiPipeline) return { success: false, error: 'aiPipeline not ready' };
    const segs = [
      {
        id: 't1',
        text: 'The lecturer outlined the team project timeline and highlighted safety checks needed before lab work.',
        startMs: 0,
        endMs: 3000,
      },
      {
        id: 't2',
        text: 'We reviewed the reference sheet from the uploaded briefing and clarified expectations for the midterm summary.',
        startMs: 3000,
        endMs: 6000,
      },
    ];
    let gotUpdate = false, gotError = null;
    const onU = () => { gotUpdate = true; };
    const onE = (e) => { gotError = e; };
    aiPipeline.on('update', onU); aiPipeline.on('error', onE);
    segs.forEach(s => aiPipeline.enqueueSegment(s));
    await new Promise(r => setTimeout(r, 5000));
    aiPipeline.off('update', onU); aiPipeline.off('error', onE);
    if (gotError) return { success: false, error: String(gotError?.message ?? gotError) };
    if (gotUpdate) return { success: true, message: 'ai:update received' };
    return { success: false, error: 'No ai:update within 5s' };
  });

  // NEW: Transcript storage handlers
  ipcMain.handle('transcript:get-full', async (_evt, sessionId) => {
    try {
      if (!transcriptStorage) return { success: false, error: 'Storage not initialized' };
      const transcript = transcriptStorage.getFullTranscript(sessionId, true);
      const session = transcriptStorage.getSession(sessionId);
      return { success: true, transcript, session };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('transcript:export', async (_evt, { sessionId, format }) => {
    try {
      if (!transcriptStorage) return { success: false, error: 'Storage not initialized' };

      let content;
      let filename = `transcript_${sessionId}`;
      let isBinary = false;

      switch (format) {
        case 'txt':
          content = transcriptStorage.exportAsText(sessionId);
          filename += '.txt';
          break;
        case 'md':
        case 'markdown':
          content = transcriptStorage.exportAsMarkdown(sessionId);
          filename += '.md';
          break;
        case 'json':
          content = transcriptStorage.exportAsJSON(sessionId);
          filename += '.json';
          break;
        case 'docx':
          content = await transcriptStorage.exportAsDOCX(sessionId);
          filename += '.docx';
          isBinary = true;
          // Convert buffer to array for IPC transfer
          content = Array.from(content);
          break;
        default:
          return { success: false, error: 'Invalid format. Use txt, md, json, or docx' };
      }

      return { success: true, content, filename, isBinary };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('transcript:get-current-session', () => {
    return { sessionId: currentSessionId };
  });

  ipcMain.handle('transcript:get-sessions', async (_evt, limit = 50) => {
    try {
      if (!transcriptStorage) {
        ensureTranscriptStorage();
      }
      const sessions = transcriptStorage.getAllSessions(limit);
      return { success: true, sessions };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('transcript:get-stats', () => {
    try {
      if (!transcriptStorage) return { success: false, error: 'Storage not initialized' };
      const stats = transcriptStorage.getStats();
      return { success: true, stats };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  // Classes + transcription records (SQLite-backed)
  ipcMain.handle('storage:classes:list', () => {
    try {
      ensureTranscriptStorage();
      const classes = transcriptStorage.listClasses();
      return { success: true, classes };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('storage:classes:save', (_evt, payload) => {
    try {
      if (!payload?.id || !payload?.name) {
        return { success: false, error: 'Class id and name are required' };
      }
      ensureTranscriptStorage();
      const saved = transcriptStorage.upsertClass(payload);
      return { success: true, class: saved };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('storage:classes:delete', (_evt, classId) => {
    try {
      if (!classId) return { success: false, error: 'classId is required' };
      ensureTranscriptStorage();
      transcriptStorage.deleteClass(classId);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('storage:transcriptions:list', (_evt, opts = {}) => {
    try {
      ensureTranscriptStorage();
      const records = transcriptStorage.listTranscriptionRecords({
        classId: opts.classId ?? null,
        limit: opts.limit ?? 100,
      });
      return { success: true, records };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('storage:transcriptions:save', (_evt, payload) => {
    try {
      if (!payload?.id || !payload?.title) {
        return { success: false, error: 'Transcription id and title are required' };
      }
      ensureTranscriptStorage();
      const saved = transcriptStorage.upsertTranscriptionRecord(payload);
      return { success: true, record: saved };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('storage:transcriptions:get', (_evt, id) => {
    try {
      if (!id) return { success: false, error: 'id is required' };
      ensureTranscriptStorage();
      const record = transcriptStorage.getTranscriptionRecord(id);
      if (!record) return { success: false, error: 'Not found' };
      if (record.sessionId && !record.content) {
        try {
          const transcript = transcriptStorage.getFullTranscript(record.sessionId, true);
          record.content = transcript;
          record.fullText = transcript;
        } catch (error) {
          console.warn('[TranscriptStorage] Failed to hydrate full transcript for', id, error);
        }
      }
      return { success: true, record };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('storage:transcriptions:delete', (_evt, id) => {
    try {
      if (!id) return { success: false, error: 'id is required' };
      ensureTranscriptStorage();
      transcriptStorage.deleteTranscriptionRecord(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e?.message ?? e) };
    }
  });

  ipcMain.handle('model-context:get', () => {
    try {
      return { success: true, settings: getModelContextSettings() };
    } catch (error) {
      return { success: false, error: String(error?.message ?? error) };
    }
  });

  ipcMain.handle('model-context:save', (_evt, settings) => {
    try {
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings payload');
      }
      store.set(MODEL_CONTEXT_KEY, settings);
      ensureAiPipeline();
      aiPipeline?.setModelContext(getModelContextSettings());
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message ?? error) };
    }
  });

  ipcMain.handle('class-context:ingest', async (_evt, payload) => {
    try {
      ensureTranscriptStorage();
      ensureAiPipeline();
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload');
      }
      const { classId, fileName, text, metadata } = payload;
      if (!classId) throw new Error('classId is required');
      if (!fileName) throw new Error('fileName is required');

      const normalized = normalizeContextText(text);
      if (!normalized) throw new Error('No text extracted from document');

      const fileHash = hashText(normalized);
      const existing = transcriptStorage.getClassContextSourceByHash(classId, fileHash);
      if (existing) {
        return { success: true, duplicate: true, sourceId: existing.id, segments: 0 };
      }

      const chunks = chunkClassContextText(normalized, {
        maxChars: 900,
        minChars: 280,
        overlapSentences: 2,
      });

      if (!chunks.length) {
        throw new Error('Document did not yield any usable context chunks');
      }
      if (chunks.length > 2000) {
        throw new Error('Document is too large to ingest (exceeds 2000 chunks)');
      }

      const sourceId = generateContextSourceId();
      transcriptStorage.createClassContextSource({
        id: sourceId,
        classId,
        fileName,
        fileHash,
        metadata: {
          size: normalized.length,
          chunkCount: chunks.length,
          ...metadata,
        },
      });

      const segments = chunks.map((textChunk, index) => ({
        id: `${sourceId}_${index}`,
        orderIndex: index,
        text: textChunk,
        metadata: { source: fileName },
      }));

      const requestId = `ctxreq_${Math.random().toString(36).slice(2)}`;

      const ingestionResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingContextIngest.delete(requestId);
          try {
            transcriptStorage.deleteClassContextSource(sourceId);
          } catch (cleanupErr) {
            console.warn('[ClassContext] Cleanup after timeout failed:', cleanupErr);
          }
          reject(new Error('Timed out while processing document context'));
        }, 45_000);

        pendingContextIngest.set(requestId, {
          resolve,
          reject,
          timeout,
          classId,
          sourceId,
        });

        aiPipeline.worker.postMessage({
          type: 'context:add',
          payload: {
            requestId,
            classId,
            sourceId,
            segments,
          },
        });
      });

      return {
        success: true,
        sourceId,
        segments: ingestionResult.segmentsSaved,
      };
    } catch (error) {
      console.error('[ClassContext] Ingest handler failed:', error);
      return { success: false, error: String(error?.message ?? error) };
    }
  });

}

// ---------- app lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createDashboardWindow();                   // show Dashboard on start

  if (process.env.OPEN_OVERLAY_ON_START === '1') createOverlayWindow();

  globalShortcut.register('CommandOrControl+Shift+T', () => { // toggle overlay
    if (!overlayWindow) createOverlayWindow();
    else if (overlayWindow.isVisible()) overlayWindow.hide();
    else overlayWindow.show();
  });

  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createDashboardWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  deepgramService?.destroy(); deepgramService = null;
  aiPipeline?.dispose(); aiPipeline = null;
  transcriptStorage?.close(); transcriptStorage = null; // NEW: Close database
});
