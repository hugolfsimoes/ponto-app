import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  generateTemplate,
  validateHeader,
  suggestFileName
} from '../../../backend/services/generateTemplate'
import { processExcel } from '../../../backend/services/processExcel'
import { generatePdf } from '../../../backend/services/generatePdf'
import type { PontoHeader, PontoData } from '../../../backend/types/ponto'

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

/**
 * Registra todos os handlers IPC do aplicativo.
 * Cada handler delega para um serviço do backend.
 */
export function registerHandlers(): void {
  // ── Fase 3: Geração do template Excel ──────────────────────────────────
  ipcMain.handle('generate-template', async (event, data: PontoHeader) => {
    const erros = validateHeader(data)
    if (erros.length > 0) {
      return { success: false, error: erros.join('; ') }
    }

    let buffer: Buffer
    try {
      const logoBuffer = await loadLogo()
      buffer = await generateTemplate(data, logoBuffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao gerar o template: ${msg}` }
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePath, canceled } = await dialog.showSaveDialog(
      win ?? BrowserWindow.getFocusedWindow()!,
      {
        title: 'Salvar Template de Ponto',
        defaultPath: suggestFileName(data),
        filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }]
      }
    )

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    try {
      await fs.writeFile(filePath, buffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao salvar o arquivo: ${msg}` }
    }

    return { success: true, filePath }
  })

  // ── Fase 4-5: Processamento do Excel ───────────────────────────────────
  ipcMain.handle('process-excel', async (event, filePath?: string) => {
    if (!filePath) {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { filePaths, canceled } = await dialog.showOpenDialog(
        win ?? BrowserWindow.getFocusedWindow()!,
        {
          title: 'Selecionar Planilha de Ponto',
          filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
          properties: ['openFile'],
        }
      )

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      filePath = filePaths[0]
    }

    try {
      return await processExcel(filePath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao processar a planilha: ${msg}` }
    }
  })

  // ── Fase 6: Geração do PDF ─────────────────────────────────────────────
  ipcMain.handle('generate-pdf', async (event, data: PontoData) => {
    if (!data || !data.header || !data.records) {
      return { success: false, error: 'Dados inválidos para geração do PDF' }
    }

    let buffer: Buffer
    try {
      const logoBuffer = await loadLogo()
      buffer = await generatePdf(data, logoBuffer)
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
}
