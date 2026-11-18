import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateStatus =
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'installing' }
  | { state: 'error'; message: string }

export const UPDATE_STATUS_CHANNEL = 'update-status'

function broadcast(status: UpdateStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(UPDATE_STATUS_CHANNEL, status)
  }
}

/**
 * Auto-update via GitHub Releases. A verificação roda ao abrir o app e só em
 * build empacotado. O download só começa quando o usuário clica em "Atualizar".
 */
export function registerUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    broadcast({ state: 'available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({ state: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    broadcast({ state: 'installing' })
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (error) => {
    broadcast({ state: 'error', message: error.message })
  })

  ipcMain.handle('update-download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      broadcast({
        state: 'error',
        message: error instanceof Error ? error.message : 'Falha ao baixar a atualização.',
      })
    }
  })

  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {
      // Sem internet ou sem release publicado: o app segue normalmente.
    })
  }
}
