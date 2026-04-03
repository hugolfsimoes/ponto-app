import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * API exposta ao renderer via contextBridge.
 * O renderer acessa via window.pontoAPI.*
 * Nenhuma lógica de negócio aqui — apenas ponte para o IPC.
 */
const pontoAPI = {
  generateTemplate: (data: unknown): Promise<unknown> =>
    ipcRenderer.invoke('generate-template', data),

  processExcel: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('process-excel', filePath),

  generatePdf: (data: unknown): Promise<unknown> =>
    ipcRenderer.invoke('generate-pdf', data)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('pontoAPI', pontoAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (apenas em dev sem contextIsolation — não deve ocorrer)
  window.electron = electronAPI
  // @ts-ignore
  window.pontoAPI = pontoAPI
}
