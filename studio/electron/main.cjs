const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
const STUDIO_URL = isDev ? 'http://localhost:3000' : 'http://127.0.0.1:3001';
const API_STATUS_URL = 'http://127.0.0.1:3001/api/status';
const LOAD_RETRY_DELAY_MS = 1000;

let mainWindow = null;
let apiProcess = null;

// Native compositor frame capture handler for pixel-perfect snapshots
ipcMain.handle('capture-page', async (_event, rect) => {
  if (!mainWindow) return null;
  try {
    const options = rect
      ? {
          x: Math.max(0, Math.round(rect.x)),
          y: Math.max(0, Math.round(rect.y)),
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        }
      : undefined;
    const nativeImg = await mainWindow.webContents.capturePage(options);
    return nativeImg.toDataURL();
  } catch (err) {
    console.error('[Electron] capturePage failed:', err);
    return null;
  }
});

// Custom window management IPC handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.on('app-restart', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('window-is-maximized', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
});

function isApiRunning() {
  return new Promise((resolve) => {
    const req = http.get(API_STATUS_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start the API server only if it is not already running.
async function ensureApiServer() {
  if (await isApiRunning()) return;

  const serverScript = path.join(__dirname, '../server/api-server.mjs');
  const serverCwd = path.join(__dirname, '..');

  const env = {
    ...process.env,
    AFTERAI_PACKAGED: app.isPackaged ? 'true' : 'false',
    EFTERAI_PACKAGED: app.isPackaged ? 'true' : 'false',
    NODE_ENV: app.isPackaged ? 'production' : (process.env.NODE_ENV || 'development'),
  };

  const execBinary = app.isPackaged
    ? process.execPath
    : (process.platform === 'win32' ? 'node.exe' : 'node');

  const execEnv = app.isPackaged
    ? { ...env, ELECTRON_RUN_AS_NODE: '1' }
    : env;

  apiProcess = spawn(execBinary, [serverScript], {
    cwd: serverCwd,
    env: execEnv,
    stdio: 'inherit',
    windowsHide: true,
  });
  apiProcess.on('error', (err) => console.error('[Electron] API server failed to start:', err.message));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0a0a0d',
    title: 'afterAi',
    icon: path.join(__dirname, '../public/logo.ico'),
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', { isMaximized: true });
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', { isMaximized: false });
    }
  });

  // External links open in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Vite may still be starting: retry instead of leaving a blank window.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, validatedURL) => {
    if (validatedURL.startsWith(STUDIO_URL) && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => mainWindow && !mainWindow.isDestroyed() && mainWindow.loadURL(STUDIO_URL), LOAD_RETRY_DELAY_MS);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(STUDIO_URL);
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.afterai.studio');
  }
  await ensureApiServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (apiProcess) apiProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
