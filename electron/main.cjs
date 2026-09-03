const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

app.name = 'COM Analyzer';
if (app.setName) {
  app.setName('COM Analyzer');
}

let mainWindow = null;
let serverProcess = null;

function startBackendServer() {
  try {
    require('../server/index.cjs');
    console.log('Backend server integrated directly in Electron process.');
  } catch (err) {
    console.error('Failed to start integrated backend server:', err);
  }
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
                  if (mainWindow) {
                    mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("OPEN_SETTINGS"))');
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
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  // Load either local dev server or built dist index.html
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || (process.env.NODE_ENV === 'development' && !app.isPackaged));
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', () => {
    console.warn('Dev server not responding, falling back to dist/index.html');
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMenu();
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
