const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require('electron');
const path = require('node:path');
const Store = require('electron-store');

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

  ipcMain.on('window-move', (event, deltaX, deltaY) => {
    if (!mainWindow) return;
    const [currentX, currentY] = mainWindow.getPosition();
    mainWindow.setPosition(currentX + deltaX, currentY + deltaY);
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

  // Placeholder handlers for Phase 2 transcription features
  ipcMain.handle('start-transcription', () => {
    console.log('Start transcription (Phase 2 feature)');
    return { success: true, message: 'Transcription will be available in Phase 2' };
  });

  ipcMain.handle('stop-transcription', () => {
    console.log('Stop transcription (Phase 2 feature)');
    return { success: true, message: 'Transcription will be available in Phase 2' };
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
    height: 150
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    ...savedBounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
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
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
