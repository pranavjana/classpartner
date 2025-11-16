// preload.js
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

// Small helper: subscribe and return an unsubscribe function
function on(channel, listener) {
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * Desktop actions (overlay/dashboard windows)
 * NOTE: ensure you have matching ipcMain handlers in src/index.js:
 *   ipcMain.handle('overlay:show', ...);
 *   ipcMain.handle('overlay:toggle', ...);
 *   ipcMain.handle('dashboard:open', ...);
 */
contextBridge.exposeInMainWorld("desktop", {
  openOverlay: () => ipcRenderer.invoke("overlay:show"),
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  openDashboard: () => ipcRenderer.invoke("dashboard:open"),
});

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  closeWindow: () => ipcRenderer.invoke('window-close'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  
  // Window position (for dragging)
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('window-move', deltaX, deltaY),
  
  // Window resize
  resizeWindow: (width, height) => ipcRenderer.send('window-resize', width, height),
  
  // Window state queries
  isAlwaysOnTop: () => ipcRenderer.invoke('is-always-on-top'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChange: (callback) => {
    if (typeof callback !== 'function') return () => {};
    return on('window:maximize-changed', (_event, state) => callback(state));
  },
  
  // Transcription features
  startTranscription: (metadata) => ipcRenderer.invoke('start-transcription', metadata),
  stopTranscription: () => ipcRenderer.invoke('stop-transcription'),
  sendAudioData: (audioData) => ipcRenderer.invoke('send-audio-data', audioData),
  getTranscriptionStatus: () => ipcRenderer.invoke('get-transcription-status'),
  
  // Transcription event listeners
  onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', (event, data) => callback(data)),
  onTranscriptionStatus: (callback) => ipcRenderer.on('transcription-status', (event, status) => callback(status)),
  onTranscriptionError: (callback) => ipcRenderer.on('transcription-error', (event, error) => callback(error)),
  onTranscriptionConnected: (callback) => ipcRenderer.on('transcription-connected', () => callback()),
  onTranscriptionDisconnected: (callback) => ipcRenderer.on('transcription-disconnected', () => callback()),
  onConnectionQualityChange: (callback) => ipcRenderer.on('connection-quality-change', (event, data) => callback(data)),
  
  // Cleanup event listeners
  removeTranscriptionListeners: () => {
    ipcRenderer.removeAllListeners('transcription-data');
    ipcRenderer.removeAllListeners('transcription-status');
    ipcRenderer.removeAllListeners('transcription-error');
    ipcRenderer.removeAllListeners('transcription-connected');
    ipcRenderer.removeAllListeners('transcription-disconnected');
    ipcRenderer.removeAllListeners('connection-quality-change');
  },
  
  // Settings and configuration
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  onSettingsUpdated: (callback) => {
    if (typeof callback !== 'function') return () => {};
    return on('settings:updated', (_event, snapshot) => callback(snapshot));
  },
  
  // Development utilities
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});


/**
 * Transcription bridge
 * Matches handlers you already have in main:
 *   start-transcription / stop-transcription / send-audio-data
 *   get-transcription-status
 *   and emits: transcription-* events
 */
contextBridge.exposeInMainWorld("transcription", {
  start: (metadata) => ipcRenderer.invoke("start-transcription", metadata),
  stop: () => ipcRenderer.invoke("stop-transcription"),
  status: () => ipcRenderer.invoke("get-transcription-status"),
  sendAudio: (uint8) => ipcRenderer.invoke("send-audio-data", uint8),

  onData: (cb) => on("transcription-data", (_e, payload) => cb(payload)),
  onStatus: (cb) => on("transcription-status", (_e, status) => cb(status)),
  onError: (cb) => on("transcription-error", (_e, err) => cb(err)),
  onConnected: (cb) => on("transcription-connected", () => cb()),
  onDisconnected: (cb) => on("transcription-disconnected", () => cb()),
  onQualityChange: (cb) => on("connection-quality-change", (_e, q) => cb(q)),

  // Convenience: clear all listeners if you re-mount UIs
  removeAll: () => {
    [
      "transcription-data",
      "transcription-status",
      "transcription-error",
      "transcription-connected",
      "transcription-disconnected",
      "connection-quality-change",
    ].forEach((ch) => ipcRenderer.removeAllListeners(ch));
  },
});

/**
 * AI pipeline bridge
 * Matches handlers/events you already wire in main
 */
contextBridge.exposeInMainWorld("ai", {
  onUpdate: (cb) => on("ai:update", (_e, p) => cb(p)),
  onError: (cb) => on("ai:error", (_e, p) => cb(p)),
  onLog: (cb) => on("ai:log", (_e, p) => cb(p)),
  availability: () => ipcRenderer.invoke("get-ai-availability"),
  ask: (query, opts) => ipcRenderer.invoke("ai:query", { query, opts }),
  selftest: (segments) => ipcRenderer.invoke("ai:selftest", { segments }),
  lostRecap: (payload) => ipcRenderer.invoke("ai:lost-recap", payload),
});

/**
 * Window controls & utils
 * Matches the handlers you registered in main
 */
contextBridge.exposeInMainWorld("windowCtl", {
  close: () => ipcRenderer.invoke("window-close"),
  minimize: () => ipcRenderer.invoke("window-minimize"),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("toggle-always-on-top"),
  isAlwaysOnTop: () => ipcRenderer.invoke("is-always-on-top"),
  getBounds: () => ipcRenderer.invoke("get-window-bounds"),
  // Resize uses a fire-and-forget channel (you already listen with ipcMain.on)
  resize: (width, height) => ipcRenderer.send("window-resize", width, height),
  openDevTools: () => ipcRenderer.invoke("open-dev-tools"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});

/**
 * Settings storage
 */
contextBridge.exposeInMainWorld("settings", {
  get: () => ipcRenderer.invoke("get-settings"),
  update: (settings) => ipcRenderer.invoke("update-settings", settings),
});

/**
 * Simple event bus helpers you're using already
 */
contextBridge.exposeInMainWorld("bus", {
  // UI -> UI: let renderers dispatch and listen to this DOM event locally
  jumpTo: (msRange) =>
    window.dispatchEvent(new CustomEvent("qa:jump", { detail: msRange })),
  // Renderer -> main: send final segment into AI pipeline
  sendFinal: (seg) => ipcRenderer.send("transcript:final", seg),
});

/**
 * Transcript storage API (NEW)
 */
contextBridge.exposeInMainWorld("transcriptStorage", {
  getCurrentSession: () => ipcRenderer.invoke("transcript:get-current-session"),
  getFullTranscript: (sessionId) => ipcRenderer.invoke("transcript:get-full", sessionId),
  getSegmentWindow: (options) => ipcRenderer.invoke("transcript:get-window", options),
  exportTranscript: (sessionId, format) => ipcRenderer.invoke("transcript:export", { sessionId, format }),
  getSessions: (limit) => ipcRenderer.invoke("transcript:get-sessions", limit),
  getStats: () => ipcRenderer.invoke("transcript:get-stats"),
  listClasses: () => ipcRenderer.invoke("storage:classes:list"),
  saveClass: (payload) => ipcRenderer.invoke("storage:classes:save", payload),
  deleteClass: (classId) => ipcRenderer.invoke("storage:classes:delete", classId),
  archiveClass: (classId, archived) => ipcRenderer.invoke("storage:classes:archive", { classId, archived }),
  listTranscriptions: (opts) => ipcRenderer.invoke("storage:transcriptions:list", opts),
  saveTranscription: (payload) => ipcRenderer.invoke("storage:transcriptions:save", payload),
  getTranscription: (id) => ipcRenderer.invoke("storage:transcriptions:get", id),
  deleteTranscription: (id) => ipcRenderer.invoke("storage:transcriptions:delete", id),
  getQABySession: (sessionId) => ipcRenderer.invoke("storage:qa:get-by-session", sessionId),
  getQAByRecord: (recordId) => ipcRenderer.invoke("storage:qa:get-by-record", recordId),
});

contextBridge.exposeInMainWorld("transcriptionEvents", {
  onUpdate: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('transcription-record:update', handler);
    return () => ipcRenderer.removeListener('transcription-record:update', handler);
  },
});

contextBridge.exposeInMainWorld("modelContext", {
  get: () => ipcRenderer.invoke("model-context:get"),
  save: (settings) => ipcRenderer.invoke("model-context:save", settings),
});

/**
 * Generic invoker (escape hatch)
 */
contextBridge.exposeInMainWorld("api", {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
});
