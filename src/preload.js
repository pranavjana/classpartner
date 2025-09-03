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
  
  // Window state queries
  isAlwaysOnTop: () => ipcRenderer.invoke('is-always-on-top'),
  
  // Future expansion for Phase 2
  // These will be used for transcription features
  startTranscription: () => ipcRenderer.invoke('start-transcription'),
  stopTranscription: () => ipcRenderer.invoke('stop-transcription'),
  onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback),
  
  // Settings and configuration
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  
  // Development utilities
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});

// Security: Remove node integration and context isolation is enabled
// This ensures renderer process cannot access Node.js APIs directly
