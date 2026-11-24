const { contextBridge, ipcRenderer } = require('electron');

// Restricted preload for VTT and Presentation windows: omits host admin/filesystem IPCs.
contextBridge.exposeInMainWorld('electronAPI', {
  openPresentationWindow: (params) => ipcRenderer.invoke('open-presentation-window', params),
  closePresentationWindow: () => ipcRenderer.invoke('close-presentation-window'),
  onPresentationStatusUpdate: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('presentation-status-update', subscription);
    return () => ipcRenderer.removeListener('presentation-status-update', subscription);
  }
});
