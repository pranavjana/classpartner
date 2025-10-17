// src/index.js
const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('node:path');
const Store = require('electron-store');
require('dotenv').config();

const DeepgramService = require('../src/services/deepGram.js');        // ⬅ adjust if your services/ live elsewhere
const { AIPipeline } = require('../src/services/ai/pipeline');          // ⬅ adjust if needed
const TranscriptStorage = require('../src/services/transcriptStorage'); // NEW: SQLite storage

const store = new Store();
const isDev = !app.isPackaged;
const PRELOAD = path.join(__dirname, 'preload.js');


let overlayWindow = null;    // frameless always-on-top widget
let dashboardWindow = null;  // full window for Next dashboard

let deepgramService = null;
let aiPipeline = null;
let transcriptStorage = null; // NEW: Storage service
let currentSessionId = null;  // NEW: Track current recording session

// ---------- helpers
function sendToAll(channel, payload) {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(channel, payload);
  if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.webContents.send(channel, payload);
}
function cryptoRandomId() {
  return 'seg_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
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

function ensureAiPipeline() {
  if (aiPipeline) return;
  aiPipeline = new AIPipeline({
    summaryWindowMs: Number(process.env.AI_SUMMARY_WINDOW_MS || 60_000),
    minSummarizeEveryMs: Number(process.env.AI_MIN_SUMMARIZE_EVERY_MS || 12_000),
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

  aiPipeline.on('update', (payload) => sendToAll('ai:update', payload));
  aiPipeline.on('log',    (payload) => { console.log('[AI PIPELINE][log]', payload); sendToAll('ai:log', payload); });
  aiPipeline.on('error',  (e) => sendToAll('ai:error', { message: String(e?.message ?? e) }));

  // NEW: Listen for segments to save to disk
  aiPipeline.worker.on('message', (msg) => {
    if (msg?.type === 'segment:save') {
      const { segment, embedding } = msg.payload;
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
  });
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
  ipcMain.handle('start-transcription', async () => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) return { success: false, error: 'Deepgram API key not found. Add DEEPGRAM_API_KEY to .env' };

      if (!deepgramService) { deepgramService = new DeepgramService(apiKey); setupDeepgramEventHandlers(); }
      ensureTranscriptStorage(); // NEW: Initialize storage
      ensureAiPipeline();

      // NEW: Create session
      currentSessionId = 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      transcriptStorage.createSession(currentSessionId);

      // NEW: Notify AI worker of session start
      aiPipeline.worker.postMessage({ type: 'session:start', payload: { sessionId: currentSessionId } });

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

  ipcMain.handle('ai:selftest', async () => {
    if (!aiPipeline) return { success: false, error: 'aiPipeline not ready' };
    const segs = [
      { id: 't1', text: 'Gradient descent updates parameters to minimize loss.', startMs: 0, endMs: 3000 },
      { id: 't2', text: 'L2 regularization reduces overfitting by penalizing large weights.', startMs: 3000, endMs: 6000 },
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
