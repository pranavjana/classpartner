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
