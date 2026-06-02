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

export interface TimeEntry {
  hora: number
  minuto: number
}

export interface ManualPontoRecordInput {
  dia: number
  entrada: TimeEntry | null
  inicioIntervalo: TimeEntry | null
  fimIntervalo: TimeEntry | null
  saida: TimeEntry | null
  folga: boolean
}

export interface Organization {
  id: string
  nome: string
  logoPath: string
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  organizationId: string
  nome: string
  setor: string
  createdAt: string
  updatedAt: string
}

export interface LocalData {
  version: 1
  organizations: Organization[]
  employees: Employee[]
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
  generateTemplate: (input: {
    header: PontoHeader
    logoPath?: string
  }) => Promise<TemplateResult>
  processExcel: (filePath: string) => Promise<ProcessResult>
  generatePdf: (input: { data: unknown; logoPath?: string }) => Promise<PdfResult>
  loadLocalData: () => Promise<LocalData>
  selectLogoFile: () => Promise<{ canceled?: boolean; filePath?: string }>
  createOrganization: (input: {
    nome: string
    logoSourcePath: string
  }) => Promise<Organization>
  updateOrganization: (input: {
    id: string
    nome: string
    logoSourcePath?: string
  }) => Promise<Organization>
  deleteOrganization: (
    id: string,
  ) => Promise<{ success: boolean; error?: string }>
  createEmployee: (input: {
    organizationId: string
    nome: string
    setor: string
  }) => Promise<Employee>
  updateEmployee: (input: {
    id: string
    nome: string
    setor: string
  }) => Promise<Employee>
  deleteEmployee: (id: string) => Promise<{ success: boolean; error?: string }>
  exportBackup: () => Promise<{
    success: boolean
    canceled?: boolean
    filePath?: string
    error?: string
  }>
  importBackup: () => Promise<{
    success: boolean
    canceled?: boolean
    error?: string
  }>
}

declare global {
  interface Window {
    pontoAPI: PontoAPI
  }
}
