const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronApp', {
  isElectron: true,
  platform: process.platform,
})

contextBridge.exposeInMainWorld('electronDB', {
  query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  exec: (sql) => ipcRenderer.invoke('db:exec', sql),
  getPath: () => ipcRenderer.invoke('db:getPath'),
  
  // NOUVEAU: sauvegarde permanente dans la journée
  backupNow: () => ipcRenderer.invoke('db:backupNow'),
  exportForUSB: () => ipcRenderer.invoke('db:exportForUSB'),
})
