// Bridge between the window and the background process. The window gets
// only these few functions (window.sg), nothing else from Node or Electron.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { SdkEvent, SgApi } from '../shared/types';

const api: SgApi = {
  info: () => ipcRenderer.invoke('sdk:info'),
  start: (cameraId) => ipcRenderer.invoke('sdk:start', cameraId),
  stop: () => ipcRenderer.invoke('sdk:stop'),
  saveReport: () => ipcRenderer.invoke('report:save'),
  openReportFolder: () => ipcRenderer.invoke('report:open-folder'),
  onEvent: (cb) => {
    const listener = (_e: IpcRendererEvent, ev: SdkEvent) => cb(ev);
    ipcRenderer.on('sdk:event', listener);
    return () => ipcRenderer.removeListener('sdk:event', listener);
  },
};

contextBridge.exposeInMainWorld('sg', api);
