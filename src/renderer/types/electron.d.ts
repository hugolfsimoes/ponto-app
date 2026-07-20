/**
 * Tipos espelhados do backend para uso no renderer.
 * O renderer não importa diretamente do backend — apenas usa estes tipos
 * que correspondem às interfaces de ponto.ts.
 */

export interface PontoHeader {
  empresa: string
  nome: string
  secao: string
  funcao?: string
  mes: number
  ano: number
}

export interface TimeEntry {
  hora: number
  minuto: number
}

export type TipoDia = 'NORMAL' | 'FOLGA' | 'FERIADO'

export interface ManualPontoRecordInput {
  dia: number
  entrada: TimeEntry | null
  inicioIntervalo: TimeEntry | null
  fimIntervalo: TimeEntry | null
  saida: TimeEntry | null
  tipoDia: TipoDia
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
  cargoFuncao?: string
  defaultSchedule?: EmployeeDefaultSchedule
  createdAt: string
  updatedAt: string
}

export interface EmployeeDefaultSchedule {
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
}

export interface Section {
  id: string
  organizationId: string
  nome: string
  createdAt: string
  updatedAt: string
}

export interface LocalData {
  version: 1
  organizations: Organization[]
  sections: Section[]
  employees: Employee[]
}

export interface BuildPontoDataResult {
  success: boolean
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
  buildPontoData: (input: {
    header: PontoHeader
    records: ManualPontoRecordInput[]
  }) => Promise<BuildPontoDataResult>
  generatePdf: (input: {
    data: unknown
    logoPath?: string
    horarioFontSize?: number
  }) => Promise<PdfResult>
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
  createSection: (input: {
    organizationId: string
    nome: string
  }) => Promise<Section>
  updateSection: (input: {
    id: string
    nome: string
  }) => Promise<Section>
  deleteSection: (id: string) => Promise<{ success: boolean; error?: string }>
  createEmployee: (input: {
    organizationId: string
    nome: string
    setor: string
    cargoFuncao?: string
    defaultSchedule?: Partial<EmployeeDefaultSchedule>
  }) => Promise<Employee>
  updateEmployee: (input: {
    id: string
    nome: string
    setor: string
    cargoFuncao?: string
    defaultSchedule?: Partial<EmployeeDefaultSchedule>
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
