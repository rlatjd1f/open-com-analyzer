const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.name = 'COM Analyzer';
if (app.setName) {
  app.setName('COM Analyzer');
}

// Global Crash / Error Logger to ~/Downloads and ~/Library/Logs
function writeCrashLog(type, error) {
  try {
    const timestamp = new Date().toISOString();
    const logHeader = `==================== [${type}] ${timestamp} ====================\n`;
    const envInfo = [
      `App Version: ${app.isPackaged ? app.getVersion() : 'Dev-0.0.9'}`,
      `Electron: ${process.versions.electron}`,
      `Node: ${process.versions.node}`,
      `Platform: ${process.platform} (${process.arch})`,
      `OS: ${os.type()} ${os.release()} (${os.arch()})`,
      `Exec Path: ${process.execPath}`,
      `Working Dir: ${process.cwd()}`
    ].join('\n');

    const errDetails = error instanceof Error
      ? `${error.name}: ${error.message}\nStack:\n${error.stack}`
      : typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error);

    const fullLog = `${logHeader}${envInfo}\n\n[Error Details]\n${errDetails}\n\n`;

    // 1. Write to user's Downloads directory for easy access
    let downloadsDir = path.join(os.homedir(), 'Downloads');
    try {
      if (app.getPath) downloadsDir = app.getPath('downloads');
    } catch (e) {}

    const downloadsLogPath = path.join(downloadsDir, 'COM_Analyzer_error.log');
    try {
      fs.appendFileSync(downloadsLogPath, fullLog, 'utf8');
      console.log(`[Logger] Saved error log to: ${downloadsLogPath}`);
    } catch (e) {
      console.error('[Logger] Failed to write to Downloads log:', e);
    }

    // 2. Write to system app logs directory
    try {
      const logsDir = app.getPath ? app.getPath('logs') : path.join(os.homedir(), 'Library', 'Logs', 'COM Analyzer');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      fs.appendFileSync(path.join(logsDir, 'com-analyzer-error.log'), fullLog, 'utf8');
    } catch (e) {}

    // 3. Show native error box popup if possible
    if (dialog && dialog.showErrorBox) {
      dialog.showErrorBox(
        'COM Analyzer 실행 오류 발생',
        `프로그램 실행 중 문제가 발생했습니다.\n\n${error && error.message ? error.message : String(error)}\n\n상세 오류 로그가 다운로드 폴더에 저장되었습니다:\n${downloadsLogPath}`
      );
    }
  } catch (criticalErr) {
    console.error('[Logger] Critical logging failure:', criticalErr);
  }
}

// Catch all unhandled exceptions and promise rejections
process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
  writeCrashLog('UNCAUGHT_EXCEPTION', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled Rejection:', reason);
  writeCrashLog('UNHANDLED_REJECTION', reason);
});

// Ensure single instance to prevent EADDRINUSE conflicts
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance of COM Analyzer is already running. Focusing existing instance.');
  app.quit();
} else {
  app.on('second-instance', () => {
    const wins = Array.from(windows);
    if (wins.length > 0) {
      const mainWin = wins[0];
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    } else {
      createWindow();
    }
  });
}

const windows = new Set();
let serverStarted = false;

function startBackendServer() {
  if (serverStarted) return;
  try {
    require('../server/index.cjs');
    serverStarted = true;
    console.log('Backend server integrated directly in Electron process.');
  } catch (err) {
    console.error('Failed to start integrated backend server:', err);
    writeCrashLog('BACKEND_STARTUP_ERROR', err);
  }
}

function createWindow() {
  // Offset new windows slightly so they cascade nicely
  const offset = (windows.size % 10) * 28;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    x: 100 + offset,
    y: 100 + offset,
    minWidth: 850,
    minHeight: 600,
    title: 'COM Analyzer',
    icon: path.join(__dirname, '../assets/icon.icns'),
    titleBarStyle: 'hiddenInset', // Sleek macOS traffic light controls
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  windows.add(win);

  // Load either local dev server or built dist index.html
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || (process.env.NODE_ENV === 'development' && !app.isPackaged));
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.on('did-fail-load', () => {
    console.warn('Dev server not responding, falling back to dist/index.html');
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  // Intercept window.open() to create standard configured BrowserWindow
  win.webContents.setWindowOpenHandler(() => {
    createWindow();
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', details);
    writeCrashLog('RENDERER_PROCESS_GONE', new Error(`Reason: ${details.reason}, Exit Code: ${details.exitCode}`));
  });

  win.webContents.on('unresponsive', () => {
    console.warn('Window content is unresponsive');
    writeCrashLog('WINDOW_UNRESPONSIVE', new Error('BrowserWindow webContents became unresponsive'));
  });

  win.on('closed', () => {
    windows.delete(win);
  });

  return win;
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'COM Analyzer',
            submenu: [
              { role: 'about', label: 'About COM Analyzer' },
              { type: 'separator' },
              {
                label: '환경설정 (Preferences)...',
                accelerator: 'CmdOrCtrl+,',
                click: () => {
                  const focused = BrowserWindow.getFocusedWindow();
                  if (focused) {
                    focused.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("OPEN_SETTINGS"))');
                  }
                }
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide', label: 'Hide COM Analyzer' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: 'Quit COM Analyzer' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: '새 창 열기 (New Window)',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: '새 창 열기 (New Window)',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow()
        },
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [{ role: 'close' }])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (windows.size === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
