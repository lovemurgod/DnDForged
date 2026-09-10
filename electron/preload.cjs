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
  openBackupsFolder: () => ipcRenderer.invoke('open-backups-folder'),
  selectDataFolder: () => ipcRenderer.invoke('select-data-folder'),
  selectBackupsFolder: () => ipcRenderer.invoke('select-backups-folder'),
  backupCampaign: () => ipcRenderer.invoke('backup-campaign'),

  // GM Credentials & Campaign Management
  getGmCredentials: () => ipcRenderer.invoke('get-gm-credentials'),
  setGmCredentials: (creds) => ipcRenderer.invoke('set-gm-credentials', creds),
  gmGetCampaigns: () => ipcRenderer.invoke('gm-get-campaigns'),
  gmSaveCampaign: (campaign) => ipcRenderer.invoke('gm-save-campaign', campaign),
  gmCreateCampaign: (data) => ipcRenderer.invoke('gm-create-campaign', data),
  gmDeleteCampaign: (id) => ipcRenderer.invoke('gm-delete-campaign', id),

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
