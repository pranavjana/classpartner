const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('node:path');
const Store = require('electron-store');
require('dotenv').config();

const DeepgramService = require('./services/deepGram.js');
// ⬇️ AI pipeline (main-process worker thread)
const { AIPipeline } = require('./services/ai/pipeline');

const store = new Store();

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reloader')(module);
  } catch (err) {
    console.log('Error setting up electron-reloader:', err);
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let deepgramService = null;
let aiPipeline = null;

// Register IPC handlers once (outside createWindow to avoid duplicate registration)
function setupIpcHandlers() {
  // Handle window controls via IPC
  ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('toggle-always-on-top', () => {
    if (!mainWindow) return false;
    const current = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!current);
    return !current;
  });

  ipcMain.handle('is-always-on-top', () => {
    return mainWindow ? mainWindow.isAlwaysOnTop() : false;
  });

  ipcMain.handle('get-window-bounds', () => {
    return mainWindow ? mainWindow.getBounds() : null;
  });

  // Removed custom window-move handler - using native Electron dragging

  ipcMain.on('window-resize', (event, width, height) => {
    if (!mainWindow) return;
    mainWindow.setSize(Math.round(width), Math.round(height));
  });

  // Development utilities
  ipcMain.handle('open-dev-tools', () => {
    if (mainWindow) mainWindow.webContents.openDevTools();
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Settings management
  ipcMain.handle('get-settings', () => {
    return store.store;
  });

  ipcMain.handle('update-settings', (event, settings) => {
    Object.keys(settings).forEach(key => {
      store.set(key, settings[key]);
    });
    return store.store;
  });

  // --- AI: optional manual enqueue from renderer (if you ever want to push your own final segments)
  ipcMain.on('transcript:final', (_evt, seg) => {
  console.log('[AI PIPELINE] received final segment in main:', seg && seg.text ? seg.text.slice(0, 60) : seg);
  if (aiPipeline && seg?.text) {
    aiPipeline.enqueueSegment(seg);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai:log', { message: 'enqueued segment', textPreview: seg.text.slice(0, 60) });
    }
  }
});


  // Transcription handlers
  ipcMain.handle('start-transcription', async () => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;

      if (!apiKey) {
        return {
          success: false,
          error: 'Deepgram API key not found. Please add DEEPGRAM_API_KEY to your .env file.'
        };
      }

      // Initialize Deepgram service if not already done
      if (!deepgramService) {
        deepgramService = new DeepgramService(apiKey);
        setupDeepgramEventHandlers();
      }

      // Initialize AI pipeline once (safe even if no AI key; it will noop until configured)
      ensureAiPipeline();

      // Connect to Deepgram
      await deepgramService.connect();

      console.log('Transcription started successfully');
      return { success: true, message: 'Transcription started' };

    } catch (error) {
      console.error('Failed to start transcription:', error);
      return {
        success: false,
        error: `Failed to start transcription: ${error.message}`
      };
    }
  });

  ipcMain.handle('ai:force-backup', () => { aiPipeline.worker.postMessage({ type:'debug:forceBackup' }); });

  ipcMain.handle('stop-transcription', () => {
    try {
      if (deepgramService) {
        deepgramService.disconnect();
      }
      if (aiPipeline) {
        aiPipeline.flush();
      }

      console.log('Transcription stopped');
      return { success: true, message: 'Transcription stopped' };

    } catch (error) {
      console.error('Failed to stop transcription:', error);
      return {
        success: false,
        error: `Failed to stop transcription: ${error.message}`
      };
    }
  });

  // Send audio data to Deepgram (optimized)
  ipcMain.handle('send-audio-data', async (event, audioArray) => {
    try {
      if (deepgramService && deepgramService.isConnectedToDeepgram()) {
        const buffer = new Uint8Array(audioArray);
        const success = deepgramService.sendAudio(buffer);
        return { success };
      }
      return { success: false, error: 'Not connected to Deepgram' };
    } catch (error) {
      console.error('Failed to send audio data:', error);
      return { success: false, error: error.message };
    }
  });

  // Get transcription service status
  ipcMain.handle('get-transcription-status', () => {
    if (deepgramService) {
      return {
        connected: deepgramService.isConnectedToDeepgram(),
        status: deepgramService.getConnectionStatus()
      };
    }
    return { connected: false, status: 'disconnected' };
  });

  // --- AI: status ping (optional, for UI)
  ipcMain.handle('get-ai-availability', () => {
    const configured = Boolean(process.env.AI_PROVIDER && process.env.OPENAI_API_KEY);
    return { configured, provider: process.env.AI_PROVIDER || null, model: process.env.OPENAI_MODEL || null };
  });
}

// Ensure AI pipeline exists and is configured
function ensureAiPipeline() {
  if (aiPipeline) return;

  aiPipeline = new AIPipeline({
    summaryWindowMs: Number(process.env.AI_SUMMARY_WINDOW_MS || 60_000),
    minSummarizeEveryMs: Number(process.env.AI_MIN_SUMMARIZE_EVERY_MS || 12_000),
  });

  // Configure provider (keys remain in main)
  const provider = process.env.AI_PROVIDER || 'hybrid-gemini';

  console.log('[AI CONFIG main] gemini key present:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            'openai key present:', !!process.env.OPENAI_API_KEY,
            'openrouter key present:', !!process.env.OPENROUTER_API_KEY);

  // Only set provider if we have at least a key for the selected provider
  aiPipeline.setProviderConfig({
    provider: process.env.AI_PROVIDER || 'hybrid-gemini', // primary=gemini, backup=openai

    // Gemini (primary chat)
    geminiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

    // OpenAI (backup chat)
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    openaiModel: process.env.OPENAI_MODEL,

    // OpenRouter (fallback)
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    baseUrl:  process.env.OPENROUTER_BASE,
    model:    process.env.OPENROUTER_MODEL,
    referer:  process.env.OPENROUTER_REFERER || 'http://localhost',
    title:    process.env.OPENROUTER_TITLE   || 'Classroom Assistant',
  });

console.log('[AI CONFIG main] gemini:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY, 'openai:', !!process.env.OPENAI_API_KEY, 'openrouter:', !!process.env.OPENROUTER_API_KEY);



  // Stream AI updates to renderer
  aiPipeline.on('update', (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai:update', payload);
    }
  });

  aiPipeline.on('log', (payload) => {
  console.log('[AI PIPELINE][log]', payload);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ai:log', payload);
  }
});

  aiPipeline.on('error', (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai:error', { message: String(e?.message ?? e) });
    }
  });
}

// after ensureAiPipeline()
ipcMain.handle('ai:query', async (_evt, { query, opts }) => {
  if (!aiPipeline) return { success: false, error: 'AI pipeline not ready' };
  try {
    const result = await aiPipeline.query(query, opts); // wraps worker call
    return { success: true, ...result };
  } catch (e) {
    return { success: false, error: String(e?.message ?? e) };
  }
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

  aiPipeline.on('update', onU);
  aiPipeline.on('error', onE);

  segs.forEach(s => aiPipeline.enqueueSegment(s));

  // wait up to 5s
  await new Promise(r => setTimeout(r, 5000));

  aiPipeline.off('update', onU);
  aiPipeline.off('error', onE);

  if (gotError) return { success: false, error: String(gotError?.message ?? gotError) };
  if (gotUpdate) return { success: true, message: 'ai:update received' };
  return { success: false, error: 'No ai:update within 5s' };
});


// Set up Deepgram service event handlers
function setupDeepgramEventHandlers() {
  if (!deepgramService) return;

  deepgramService.on('transcription', (data) => {
    // Forward all transcription data to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-data', data);
    }

    // If this event represents a FINAL segment, enqueue into AI pipeline
    // Expect shapes like: { is_final: boolean, text: string, startMs, endMs, id? } — adapt if needed
    try {
      const isFinal =
        data?.is_final === true ||
        data?.type === 'final' ||
        data?.channel?.alternatives?.[0]?.transcript && data?.speech_final === true;

      const text =
        data?.text ||
        data?.channel?.alternatives?.[0]?.transcript ||
        data?.transcript ||
        '';

      if (aiPipeline && isFinal && text.trim()) {
        const seg = {
          id: data?.id || cryptoRandomId(),
          text: text.trim(),
          startMs: data?.startMs ?? null,
          endMs: data?.endMs ?? Date.now(),
        };
        aiPipeline.enqueueSegment(seg);
      }
    } catch (e) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('ai:error', { message: `AI enqueue error: ${String(e?.message ?? e)}` });
      }
    }
  });

  deepgramService.on('status', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-status', status);
    }
  });

  deepgramService.on('error', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-error', {
        message: error.message,
        type: 'deepgram-error'
      });
    }
  });

  deepgramService.on('connected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-connected');
    }
  });

  deepgramService.on('disconnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-disconnected');
    }
    // Optional: flush pending AI summary on disconnect
    if (aiPipeline) aiPipeline.flush();
  });

  deepgramService.on('quality-change', (qualityData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-quality-change', qualityData);
    }
  });
}

function cryptoRandomId() {
  // simple, dependency-free id
  return 'seg_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const createWindow = () => {
  // Get screen dimensions for positioning
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // Get saved position or default to top-right
  const savedBounds = store.get('windowBounds', {
    x: screenWidth - 420,
    y: 20,
    width: 400,
    height: 1000
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    ...savedBounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Save window position when moved
  mainWindow.on('moved', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Add fade-in effect
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setOpacity(0);
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.1;
      mainWindow.setOpacity(opacity);
      if (opacity >= 1) {
        clearInterval(fadeIn);
      }
    }, 30);
  });
};

// This method will be called when Electron has finished initialization.
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  // Register global shortcut for show/hide
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });

  // On macOS re-create a window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Unregister shortcuts and clean up services on quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();

  if (deepgramService) {
    deepgramService.destroy();
    deepgramService = null;
  }
  if (aiPipeline) {
    aiPipeline.dispose();
    aiPipeline = null;
  }
});

// In this file you can include the rest of your app's specific main process code.
// You can also put them in separate files and import them here.
