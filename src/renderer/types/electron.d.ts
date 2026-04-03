/**
 * Tipos espelhados do backend para uso no renderer.
 * O renderer não importa diretamente do backend — apenas usa estes tipos
 * que correspondem às interfaces de ponto.ts.
 */

export interface PontoHeader {
  empresa: string
  nome: string
  secao: string
  mes: number
  ano: number
}

export interface TemplateResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface ProcessResult {
  success: boolean
  canceled?: boolean
  data?: unknown
  error?: string
  errors?: Array<{ dia: number; campo: string; mensagem: string }>
}

export interface PdfResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface PontoAPI {
  generateTemplate: (data: PontoHeader) => Promise<TemplateResult>
  processExcel: (filePath: string) => Promise<ProcessResult>
  generatePdf: (data: unknown) => Promise<PdfResult>
}

declare global {
  interface Window {
    pontoAPI: PontoAPI
  }
}
