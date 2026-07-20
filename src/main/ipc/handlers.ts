import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { buildPontoDataFromManualInput } from '../../../backend/services/buildPontoDataFromManualInput'
import { generatePdf } from '../../../backend/services/generatePdf'
import {
  createEmployee,
  createOrganization,
  createSection,
  deleteEmployee,
  deleteOrganization,
  deleteSection,
  loadLocalData,
  updateEmployee,
  updateOrganization,
  updateSection,
} from '../../../backend/services/localDataStore'
import { exportBackupToFile, importBackupFromFile } from '../../../backend/services/backupStore'
import type {
  ManualPontoRecordInput,
  PontoHeader,
  PontoData,
} from '../../../backend/types/ponto'

/** Tenta carregar a logo da empresa. Retorna undefined silenciosamente se não encontrada. */
async function loadLogo(): Promise<Buffer | undefined> {
  const candidates = [
    // Produção: resources/ copiado junto ao executável
    join(app.getAppPath(), 'resources', 'protmax.jpeg'),
    // Desenvolvimento: pasta resources/ na raiz do projeto
    join(process.cwd(), 'resources', 'protmax.jpeg')
  ]

  for (const logoPath of candidates) {
    try {
      return await fs.readFile(logoPath)
    } catch {
      // Tenta o próximo candidato
    }
  }

  return undefined
}

async function loadLogoFromPath(logoPath?: string): Promise<Buffer | undefined> {
  if (!logoPath) return loadLogo()
  try {
    return await fs.readFile(logoPath)
  } catch {
    return loadLogo()
  }
}

/**
 * Registra todos os handlers IPC do aplicativo.
 * Cada handler delega para um serviço do backend.
 */
export function registerHandlers(): void {
  ipcMain.handle(
    'build-ponto-data',
    async (_event, input: { header: PontoHeader; records: unknown }) => {
      if (!input || !input.header || !Array.isArray(input.records)) {
        return {
          success: false,
          error: 'Dados invalidos para montagem da folha de ponto',
        }
      }

      try {
        return buildPontoDataFromManualInput(
          input.header,
          input.records as ManualPontoRecordInput[],
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          error: `Erro ao montar folha de ponto: ${msg}`,
        }
      }
    },
  )

  // ── Fase 6: Geração do PDF ─────────────────────────────────────────────
  ipcMain.handle('generate-pdf', async (event, input: PontoData | { data: PontoData; logoPath?: string; horarioFontSize?: number }) => {
    const data = 'data' in input ? input.data : input
    const logoPath = 'data' in input ? input.logoPath : undefined
    const horarioFontSize = 'data' in input ? input.horarioFontSize : undefined
    if (!data || !data.header || !data.records) {
      return { success: false, error: 'Dados inválidos para geração do PDF' }
    }

    let buffer: Buffer
    try {
      const logoBuffer = await loadLogoFromPath(logoPath)
      buffer = await generatePdf(data, logoBuffer, { horarioFontSize })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao gerar o PDF: ${msg}` }
    }

    const { header } = data
    const mesStr = String(header.mes).padStart(2, '0')
    const defaultName = `ponto_${header.nome.replace(/\s+/g, '_')}_${mesStr}_${header.ano}.pdf`

    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePath, canceled } = await dialog.showSaveDialog(
      win ?? BrowserWindow.getFocusedWindow()!,
      {
        title: 'Salvar Folha de Ponto PDF',
        defaultPath: defaultName,
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
      }
    )

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    try {
      await fs.writeFile(filePath, buffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao salvar o PDF: ${msg}` }
    }

    return { success: true, filePath }
  })

  // ── Cadastros locais ───────────────────────────────────────────────────
  ipcMain.handle('load-local-data', async () => {
    try {
      return await loadLocalData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { version: 1, organizations: [], sections: [], employees: [], error: msg }
    }
  })

  ipcMain.handle('select-logo-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePaths, canceled } = await dialog.showOpenDialog(
      win ?? BrowserWindow.getFocusedWindow()!,
      {
        title: 'Selecionar Logo da Empresa',
        filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg'] }],
        properties: ['openFile'],
      }
    )
    if (canceled || filePaths.length === 0) return { canceled: true }
    return { filePath: filePaths[0] }
  })

  ipcMain.handle('create-organization', async (_event, input) => {
    try {
      return await createOrganization(input)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('update-organization', async (_event, input) => {
    try {
      return await updateOrganization(input)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('delete-organization', async (_event, id: string) => {
    try {
      await deleteOrganization(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('create-section', async (_event, input) => {
    try {
      return await createSection(input)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('update-section', async (_event, input) => {
    try {
      return await updateSection(input)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('delete-section', async (_event, id: string) => {
    try {
      await deleteSection(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('create-employee', async (_event, input) => {
    try {
      return await createEmployee(input)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('update-employee', async (_event, input) => {
    try {
      return await updateEmployee(input)
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('delete-employee', async (_event, id: string) => {
    try {
      await deleteEmployee(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── Backup local ───────────────────────────────────────────────────────
  ipcMain.handle('export-backup', async (event) => {
    const date = new Date().toISOString().slice(0, 10)
    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePath, canceled } = await dialog.showSaveDialog(
      win ?? BrowserWindow.getFocusedWindow()!,
      {
        title: 'Exportar Backup do PontoApp',
        defaultPath: `pontoapp-backup-${date}.zip`,
        filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
      }
    )
    if (canceled || !filePath) return { success: false, canceled: true }
    try {
      await exportBackupToFile(filePath)
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('import-backup', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePaths, canceled } = await dialog.showOpenDialog(
      win ?? BrowserWindow.getFocusedWindow()!,
      {
        title: 'Importar Backup do PontoApp',
        filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
        properties: ['openFile'],
      }
    )
    if (canceled || filePaths.length === 0) return { success: false, canceled: true }
    try {
      await importBackupFromFile(filePaths[0])
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
