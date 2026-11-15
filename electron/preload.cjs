const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  saveDataSync: (data) => ipcRenderer.sendSync('data:saveSync', data),
  dataLocation: () => ipcRenderer.invoke('data:location'),
  exportBackup: (data) => ipcRenderer.invoke('backup:export', data),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  getJson: (url) => ipcRenderer.invoke('net:getJson', url),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
});
