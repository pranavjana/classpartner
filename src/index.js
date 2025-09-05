const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('node:path');
const Store = require('electron-store');
require('dotenv').config();

const DeepgramService = require('./services/deepGram.js');

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

  ipcMain.on('window-move', (event, deltaX, deltaY) => {
    if (!mainWindow) return;
    const [currentX, currentY] = mainWindow.getPosition();
    mainWindow.setPosition(currentX + deltaX, currentY + deltaY);
  });

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

  ipcMain.handle('stop-transcription', () => {
    try {
      if (deepgramService) {
        deepgramService.disconnect();
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
        // Optimized buffer conversion - avoid unnecessary array operations
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
}

// Set up Deepgram service event handlers
function setupDeepgramEventHandlers() {
  if (!deepgramService || !mainWindow) return;

  deepgramService.on('transcription', (data) => {
    console.log('Sending transcription to renderer:', data);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-data', data);
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
  });

  deepgramService.on('quality-change', (qualityData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('connection-quality-change', qualityData);
    }
  });
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
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

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Unregister shortcuts when app is about to quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  
  // Clean up Deepgram service
  if (deepgramService) {
    deepgramService.destroy();
    deepgramService = null;
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
