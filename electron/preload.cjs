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

  // Database Sources & Homebrew Management
  sourcesGetAll: (campaignId) => ipcRenderer.invoke('sources-get-all', campaignId),
  sourcesToggle: (params) => ipcRenderer.invoke('sources-toggle', params),
  sourcesBatchToggle: (params) => ipcRenderer.invoke('sources-batch-toggle', params),
  sourcesApplyPreset: (params) => ipcRenderer.invoke('sources-apply-preset', params),
  sourcesGetDetails: (params) => ipcRenderer.invoke('sources-get-details', params),
  sourcesSaveDetails: (data) => ipcRenderer.invoke('sources-save-details', data),
  sourcesAddFile: (params) => ipcRenderer.invoke('sources-add-file', params),
  sourcesCreateCustom: (data) => ipcRenderer.invoke('sources-create-custom', data),
  sourcesDeleteCustom: (params) => ipcRenderer.invoke('sources-delete-custom', params),
  sourcesRevealFile: (filePath) => ipcRenderer.invoke('sources-reveal-file', filePath),
  sourcesSearchCompendium: (params) => ipcRenderer.invoke('sources-search-compendium', params),
  sourcesGetEntityFull: (params) => ipcRenderer.invoke('sources-get-entity-full', params),
  sourcesExport: (params) => ipcRenderer.invoke('sources-export', params),
  sourcesSelectAsset: () => ipcRenderer.invoke('sources-select-asset'),
  sourcesSearchGlobal: (params) => ipcRenderer.invoke('sources-search-global', params),
  sourcesGetPreview: (params) => ipcRenderer.invoke('sources-get-preview', params),
  sourcesSelectImportFiles: () => ipcRenderer.invoke('sources-select-import-files'),
  sourcesSelectImportFolder: () => ipcRenderer.invoke('sources-select-import-folder'),
  sourcesInspectBulk: (params) => ipcRenderer.invoke('sources-inspect-bulk', params),
  sourcesExecuteBulkImport: (params) => ipcRenderer.invoke('sources-execute-bulk-import', params),

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
