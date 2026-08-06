const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  startTunnel: (params) => ipcRenderer.invoke('start-tunnel', params),
  stopTunnel: () => ipcRenderer.invoke('stop-tunnel'),
  openVttApp: () => ipcRenderer.invoke('open-vtt-app'),
  openVttBrowser: (url) => ipcRenderer.invoke('open-vtt-browser', url),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  backupCampaign: () => ipcRenderer.invoke('backup-campaign'),

  onStatusUpdate: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('status-update', subscription);
    return () => ipcRenderer.removeListener('status-update', subscription);
  },

  onLogUpdate: (callback) => {
    const subscription = (_, log) => callback(log);
    ipcRenderer.on('log-update', subscription);
    return () => ipcRenderer.removeListener('log-update', subscription);
  }
});
