// Background (main) process: creates the window, owns the SDK session,
// and answers the window's requests over IPC.
import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { SdkSession } from './sdk';
import { writeReport } from './report';
import type { SdkEvent } from '../shared/types';

// .env sits in the project folder next to package.json.
loadEnv({ path: join(app.getAppPath(), '.env'), quiet: true });

const reportDir = join(app.getAppPath(), 'sdk-reports');
let win: BrowserWindow | null = null;

const send = (e: SdkEvent) => {
  if (win && !win.isDestroyed()) win.webContents.send('sdk:event', e);
};
const sdk = new SdkSession(process.env.SMARTSPECTRA_API_KEY?.trim() || undefined, send);

function saveReport(): string | null {
  const r = sdk.report();
  if (r.messageCount === 0 && r.errorsSeen.length === 0) return null;
  return writeReport(reportDir, r);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    backgroundColor: '#14161c',
    title: 'Second Guess',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  // Our window only ever shows its own local page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.loadFile(join(__dirname, '../renderer/index.html'));
  if (process.env.SG_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' });
}

ipcMain.handle('sdk:info', () => sdk.info(reportDir));
ipcMain.handle('sdk:start', (_e, cameraId: string | null) => sdk.start(cameraId));
ipcMain.handle('sdk:stop', async () => {
  await sdk.stop();
  const file = saveReport();
  if (file) send({ type: 'log', text: `Field report saved: ${file}` });
});
ipcMain.handle('report:save', () => saveReport());
ipcMain.handle('report:open-folder', async () => {
  await shell.openPath(reportDir);
});

app.whenReady().then(() => {
  // The SDK opens the camera natively in this process; the page itself never
  // needs camera, microphone or any other permission.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  createWindow();
});

let quitting = false;
app.on('before-quit', (event) => {
  if (quitting || !sdk.isRunning) return;
  event.preventDefault();
  quitting = true;
  void sdk.stop().finally(() => {
    saveReport();
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
