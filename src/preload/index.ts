import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/**
 * API exposta ao renderer via contextBridge.
 * O renderer acessa via window.pontoAPI.*
 * Nenhuma lógica de negócio aqui — apenas ponte para o IPC.
 */
const pontoAPI = {
  buildPontoData: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('build-ponto-data', input),

  generatePdf: (data: unknown): Promise<unknown> =>
    ipcRenderer.invoke('generate-pdf', data),

  loadLocalData: (): Promise<unknown> => ipcRenderer.invoke('load-local-data'),

  selectLogoFile: (): Promise<unknown> => ipcRenderer.invoke('select-logo-file'),

  createOrganization: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('create-organization', input),

  updateOrganization: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('update-organization', input),

  deleteOrganization: (id: string): Promise<unknown> =>
    ipcRenderer.invoke('delete-organization', id),

  createSection: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('create-section', input),

  updateSection: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('update-section', input),

  deleteSection: (id: string): Promise<unknown> =>
    ipcRenderer.invoke('delete-section', id),

  createEmployee: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('create-employee', input),

  updateEmployee: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('update-employee', input),

  deleteEmployee: (id: string): Promise<unknown> =>
    ipcRenderer.invoke('delete-employee', id),

  exportBackup: (): Promise<unknown> => ipcRenderer.invoke('export-backup'),

  importBackup: (): Promise<unknown> => ipcRenderer.invoke('import-backup')
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
