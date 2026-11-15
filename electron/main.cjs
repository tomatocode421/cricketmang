// Electron main process: window management, local data storage, backups and
// network requests for weather / ground research (kept out of the page so no
// keys or cross-origin issues reach the UI).
const { app, BrowserWindow, ipcMain, dialog, shell, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = () => path.join(app.getPath('userData'), 'cricket-data.json');
const PREV_FILE = () => path.join(app.getPath('userData'), 'cricket-data.previous.json');

function readData() {
  for (const file of [DATA_FILE(), PREV_FILE()]) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error('Could not read', file, err);
    }
  }
  return null;
}

function writeData(data) {
  const file = DATA_FILE();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, PREV_FILE());
  fs.renameSync(tmp, file);
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0f1112',
    title: 'Cricket Team Manager',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Open external links (e.g. Wikipedia sources) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_e, data) => writeData(data));
ipcMain.handle('data:location', () => DATA_FILE());
// Synchronous save used when the window is closing so nothing is lost.
ipcMain.on('data:saveSync', (e, data) => {
  try {
    writeData(data);
    e.returnValue = true;
  } catch (err) {
    e.returnValue = false;
  }
});

ipcMain.handle('backup:export', async (_e, data) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save backup',
    defaultPath: path.join(app.getPath('documents'), `Cricket-Backup-${stamp}.json`),
    filters: [{ name: 'Cricket Team Manager backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose a backup to restore',
    properties: ['openFile'],
    filters: [{ name: 'Cricket Team Manager backup', extensions: ['json'] }],
  });
  if (canceled || !filePaths?.length) return { ok: false, canceled: true };
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    return { ok: true, data, filePath: filePaths[0] };
  } catch (err) {
    return { ok: false, error: 'That file is not a valid backup.' };
  }
});

// Only these hosts may be requested from the page.
const ALLOWED_HOSTS = new Set([
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'archive-api.open-meteo.com',
  'en.wikipedia.org',
]);

ipcMain.handle('net:getJson', async (_e, url) => {
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return { ok: false, error: 'Invalid address' };
  }
  if (!ALLOWED_HOSTS.has(host)) return { ok: false, error: 'Host not allowed' };
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': 'CricketTeamManager/1.0 (personal desktop app)' } });
    if (!res.ok) return { ok: false, status: res.status, error: `Request failed (${res.status})` };
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: 'No internet connection or the service is unavailable.' };
  }
});

ipcMain.handle('shell:open', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
      ])
    );
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
