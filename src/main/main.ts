// Background (main) process: creates the window, owns the SDK session,
// and answers the window's requests over IPC.
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import { join } from 'node:path';
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { SdkSession } from './sdk';
import { writeReport } from './report';
import { Store } from './store';
import type { Review, SdkEvent, Settings } from '../shared/types';
import type { CardState } from '../core/scheduler';

// .env sits in the project folder next to package.json.
loadEnv({ path: join(app.getAppPath(), '.env'), quiet: true });

const reportDir = join(app.getAppPath(), 'sdk-reports');
let win: BrowserWindow | null = null;
let store: Store;

// Camera log: start/stop (with the reason), status changes and SDK errors, so
// "why did the camera stop?" can always be answered. Text only, no images.
let lastLoggedValidation = '';
function camLog(line: string): void {
  try {
    mkdirSync(reportDir, { recursive: true });
    appendFileSync(join(reportDir, 'camera-log.txt'), `${new Date().toISOString()}  ${line}\n`, 'utf8');
  } catch {
    /* logging must never break the app */
  }
}

const send = (e: SdkEvent) => {
  if (e.type === 'camera') camLog(e.on ? 'camera ON' : `camera OFF (${e.reason ?? 'unknown'})`);
  else if (e.type === 'processing') camLog(`status ${e.name}`);
  else if (e.type === 'error') camLog(`SDK error ${e.name} (${e.code}): ${e.message}${e.retryable ? ' [retryable]' : ''}`);
  else if (e.type === 'validation' && e.name !== lastLoggedValidation) {
    lastLoggedValidation = e.name;
    camLog(`camera signal ${e.name}`);
  } else if (e.type === 'log') camLog(e.text);
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
ipcMain.handle('sdk:stop', async (_e, reason: string) => {
  await sdk.stop(reason === 'user' ? 'user' : 'internal');
  const file = saveReport();
  if (file) send({ type: 'log', text: `Field report saved: ${file}` });
});
ipcMain.handle('report:save', () => saveReport());
ipcMain.handle('sdk:camera-state', () => sdk.cameraState());
ipcMain.handle('sdk:recall-window', (_e, fromMs: number, toMs: number) => sdk.recallWindow(fromMs, toMs));

ipcMain.handle('store:get-settings', () => store.getSettings());
ipcMain.handle('store:update-settings', (_e, patch: Partial<Settings>) => store.updateSettings(patch));
ipcMain.handle('store:list-decks', () => store.listDecks());
ipcMain.handle('store:get-deck', (_e, id: string) => store.getDeck(id));
ipcMain.handle('store:delete-deck', (_e, id: string) => store.deleteDeck(id));
ipcMain.handle('store:add-reviews', (_e, reviews: Review[]) => store.addReviews(reviews));
ipcMain.handle('store:get-schedule', (_e, deckId: string) => store.getSchedule(deckId));
ipcMain.handle('store:get-reviews', () => store.getReviews());
ipcMain.handle('store:export-csv', async () => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Export progress',
    defaultPath: join(app.getPath('documents'), `second-guess-progress-${new Date().toISOString().slice(0, 10)}.csv`),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (res.canceled || !res.filePath) return null;
  writeFileSync(res.filePath, store.exportCsv(), 'utf8');
  return res.filePath;
});
ipcMain.handle('store:delete-all', async () => {
  await sdk.stop('internal');
  store.deleteAll();
  rmSync(reportDir, { recursive: true, force: true }); // field reports + camera log
});
ipcMain.handle('store:save-card-states', (_e, states: CardState[]) => store.saveCardStates(states));
ipcMain.handle('store:import-deck', async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Import a deck',
    properties: ['openFile'],
    filters: [
      { name: 'Decks (CSV or Anki text export)', extensions: ['csv', 'txt', 'tsv'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (res.canceled || res.filePaths.length === 0) return { ok: false, cancelled: true };
  return store.importDeck(res.filePaths[0]);
});
ipcMain.handle('report:open-folder', async () => {
  await shell.openPath(reportDir);
});

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'), join(app.getAppPath(), 'decks'));
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
