// Bridge between the window and the background process. The window gets
// only these few functions (window.sg), nothing else from Node or Electron.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { SdkEvent, SgApi } from '../shared/types';

const api: SgApi = {
  info: () => ipcRenderer.invoke('sdk:info'),
  start: (cameraId) => ipcRenderer.invoke('sdk:start', cameraId),
  stop: () => ipcRenderer.invoke('sdk:stop'),
  cameraState: () => ipcRenderer.invoke('sdk:camera-state'),
  recallWindow: (fromMs, toMs) => ipcRenderer.invoke('sdk:recall-window', fromMs, toMs),
  saveReport: () => ipcRenderer.invoke('report:save'),
  openReportFolder: () => ipcRenderer.invoke('report:open-folder'),
  getSettings: () => ipcRenderer.invoke('store:get-settings'),
  updateSettings: (patch) => ipcRenderer.invoke('store:update-settings', patch),
  listDecks: () => ipcRenderer.invoke('store:list-decks'),
  getDeck: (id) => ipcRenderer.invoke('store:get-deck', id),
  importDeck: () => ipcRenderer.invoke('store:import-deck'),
  deleteDeck: (id) => ipcRenderer.invoke('store:delete-deck', id),
  addReviews: (reviews) => ipcRenderer.invoke('store:add-reviews', reviews),
  onEvent: (cb) => {
    const listener = (_e: IpcRendererEvent, ev: SdkEvent) => cb(ev);
    ipcRenderer.on('sdk:event', listener);
    return () => ipcRenderer.removeListener('sdk:event', listener);
  },
};

contextBridge.exposeInMainWorld('sg', api);
