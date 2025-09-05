// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
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
  
  // Transcription features
  startTranscription: () => ipcRenderer.invoke('start-transcription'),
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
  
  // Development utilities
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});

// Security: Remove node integration and context isolation is enabled
// This ensures renderer process cannot access Node.js APIs directly
contextBridge.exposeInMainWorld('transcription', {
  start: () => ipcRenderer.invoke('start-transcription'),
  stop:  () => ipcRenderer.invoke('stop-transcription'),
  status: () => ipcRenderer.invoke('get-transcription-status'),
  sendAudio: (uint8) => ipcRenderer.invoke('send-audio-data', uint8),

  onData:   (cb) => ipcRenderer.on('transcription-data', (_e, payload) => cb(payload)),
  onStatus: (cb) => ipcRenderer.on('transcription-status', (_e, status) => cb(status)),
  onError:  (cb) => ipcRenderer.on('transcription-error', (_e, err) => cb(err)),
  onConnected:    (cb) => ipcRenderer.on('transcription-connected', (_e) => cb()),
  onDisconnected: (cb) => ipcRenderer.on('transcription-disconnected', (_e) => cb()),
  onQualityChange:(cb) => ipcRenderer.on('connection-quality-change', (_e, q) => cb(q)),
});

// --- AI bridge (pipeline updates) ---

contextBridge.exposeInMainWorld('ai', {
  onUpdate: (cb) => ipcRenderer.on('ai:update', (_e, p) => cb(p)),
  onError:  (cb) => ipcRenderer.on('ai:error',  (_e, p) => cb(p)),
  onLog:    (cb) => ipcRenderer.on('ai:log',    (_e, p) => cb(p)),
  availability: () => ipcRenderer.invoke('get-ai-availability'),
  ask: (query, opts) => ipcRenderer.invoke('ai:query', { query, opts }),
  selftest: () => ipcRenderer.invoke('ai:selftest'), // NEW
});



// --- Optional window utils you already had ---
contextBridge.exposeInMainWorld('windowCtl', {
  close:   () => ipcRenderer.invoke('window-close'),
  minimize:() => ipcRenderer.invoke('window-minimize'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  isAlwaysOnTop:     () => ipcRenderer.invoke('is-always-on-top'),
  getBounds:         () => ipcRenderer.invoke('get-window-bounds'),
  openDevTools:      () => ipcRenderer.invoke('open-dev-tools'),
  getAppVersion:     () => ipcRenderer.invoke('get-app-version'),
});

// (Optional) simple bus to send final segments manually, if you use it
contextBridge.exposeInMainWorld('bus', {
  sendFinal: (seg) => ipcRenderer.send('transcript:final', seg),
});