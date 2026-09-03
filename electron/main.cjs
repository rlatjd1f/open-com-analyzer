const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');

app.name = 'COM Analyzer';
if (app.setName) {
  app.setName('COM Analyzer');
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
