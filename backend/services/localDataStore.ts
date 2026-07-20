import { app } from 'electron'
import { promises as fs } from 'fs'
import { dirname, extname, join } from 'path'
import type {
  CreateEmployeeInput,
  CreateOrganizationInput,
  CreateSectionInput,
  Employee,
  EmployeeDefaultSchedule,
  LocalData,
  Organization,
  Section,
  UpdateEmployeeInput,
  UpdateOrganizationInput,
  UpdateSectionInput,
} from '../types/cadastros'

const DATA_DIR_NAME = 'pontoapp-data'
const DATA_FILE_NAME = 'dados.json'
const LOGOS_DIR_NAME = 'logos'
const ALLOWED_LOGO_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])

export function getDataDir(): string {
  return join(app.getPath('userData'), DATA_DIR_NAME)
}

export function getDataFilePath(): string {
  return join(getDataDir(), DATA_FILE_NAME)
}

export function getLogosDir(): string {
  return join(getDataDir(), LOGOS_DIR_NAME)
}

export function emptyLocalData(): LocalData {
  return { version: 1, organizations: [], sections: [], employees: [] }
}

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function assertText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} e obrigatorio.`)
  return trimmed
}

function normalizeOptionalText(value?: string): string | undefined {
  const trimmed = value?.trim() ?? ''
  return trimmed || undefined
}

const SCHEDULE_FIELDS: Array<keyof EmployeeDefaultSchedule> = [
  'entrada',
  'inicioIntervalo',
  'fimIntervalo',
  'saida',
]

function normalizeDefaultSchedule(
  schedule?: Partial<EmployeeDefaultSchedule>,
): EmployeeDefaultSchedule | undefined {
  if (!schedule) return undefined
  const values = SCHEDULE_FIELDS.map((field) => schedule[field]?.trim() ?? '')
  if (values.every((value) => value === '')) return undefined
  if (values.some((value) => value === '')) {
    throw new Error('Preencha todos os horarios padrao ou deixe todos em branco.')
  }
  const invalid = values.some(
    (value) => !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value),
  )
  if (invalid) throw new Error('Horarios padrao devem estar no formato HH:mm.')
  return {
    entrada: values[0],
    inicioIntervalo: values[1],
    fimIntervalo: values[2],
    saida: values[3],
  }
}

function assertLogoExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (!ALLOWED_LOGO_EXTENSIONS.has(ext)) {
    throw new Error('A logo deve ser PNG, JPG ou JPEG.')
  }
  return ext
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(getLogosDir(), { recursive: true })
  try {
    await fs.access(getDataFilePath())
  } catch {
    await saveLocalData(emptyLocalData())
  }
}

export async function loadLocalData(): Promise<LocalData> {
  await ensureStore()
  const raw = await fs.readFile(getDataFilePath(), 'utf-8')
  const parsed = JSON.parse(raw) as LocalData
  if (parsed.version !== 1 || !Array.isArray(parsed.organizations) || !Array.isArray(parsed.employees)) {
    throw new Error('Arquivo de dados local invalido.')
  }
  if (!Array.isArray(parsed.sections)) {
    parsed.sections = []
    await saveLocalData(parsed)
  }
  return parsed
}

export async function saveLocalData(data: LocalData): Promise<void> {
  const filePath = getDataFilePath()
  await fs.mkdir(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tempPath, filePath)
}

async function copyLogoForOrganization(sourcePath: string, organizationId: string): Promise<string> {
  const ext = assertLogoExtension(sourcePath)
  await fs.mkdir(getLogosDir(), { recursive: true })
  const targetPath = join(getLogosDir(), `${organizationId}${ext}`)
  await fs.copyFile(sourcePath, targetPath)
  return targetPath
}

async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Missing files are harmless during cleanup.
  }
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const data = await loadLocalData()
  const id = createId()
  const createdAt = nowIso()
  const organization: Organization = {
    id,
    nome: assertText(input.nome, 'Nome da empresa'),
    logoPath: await copyLogoForOrganization(input.logoSourcePath, id),
    createdAt,
    updatedAt: createdAt,
  }
  data.organizations.push(organization)
  await saveLocalData(data)
  return organization
}

export async function updateOrganization(input: UpdateOrganizationInput): Promise<Organization> {
  const data = await loadLocalData()
  const organization = data.organizations.find((item) => item.id === input.id)
  if (!organization) throw new Error('Empresa nao encontrada.')

  organization.nome = assertText(input.nome, 'Nome da empresa')
  if (input.logoSourcePath) {
    const previousLogoPath = organization.logoPath
    organization.logoPath = await copyLogoForOrganization(input.logoSourcePath, organization.id)
    if (previousLogoPath !== organization.logoPath) await removeFileIfExists(previousLogoPath)
  }
  organization.updatedAt = nowIso()
  await saveLocalData(data)
  return organization
}

export async function deleteOrganization(id: string): Promise<void> {
  const data = await loadLocalData()
  const organization = data.organizations.find((item) => item.id === id)
  if (!organization) throw new Error('Empresa nao encontrada.')
  data.organizations = data.organizations.filter((item) => item.id !== id)
  data.sections = data.sections.filter((item) => item.organizationId !== id)
  data.employees = data.employees.filter((item) => item.organizationId !== id)
  await saveLocalData(data)
  await removeFileIfExists(organization.logoPath)
}

function assertOrganizationExists(data: LocalData, organizationId: string): void {
  if (!data.organizations.some((item) => item.id === organizationId)) {
    throw new Error('Empresa nao encontrada.')
  }
}

function assertSectionForOrganization(data: LocalData, organizationId: string, setor: string): string {
  const trimmed = assertText(setor, 'Secao')
  const exists = data.sections.some(
    (section) => section.organizationId === organizationId && section.nome === trimmed,
  )
  if (!exists) throw new Error('Secao nao encontrada para esta empresa.')
  return trimmed
}

export async function createSection(input: CreateSectionInput): Promise<Section> {
  const data = await loadLocalData()
  assertOrganizationExists(data, input.organizationId)
  const nome = assertText(input.nome, 'Secao')
  const duplicate = data.sections.some(
    (section) => section.organizationId === input.organizationId && section.nome === nome,
  )
  if (duplicate) throw new Error('Secao ja cadastrada para esta empresa.')
  const createdAt = nowIso()
  const section: Section = {
    id: createId(),
    organizationId: input.organizationId,
    nome,
    createdAt,
    updatedAt: createdAt,
  }
  data.sections.push(section)
  await saveLocalData(data)
  return section
}

export async function updateSection(input: UpdateSectionInput): Promise<Section> {
  const data = await loadLocalData()
  const section = data.sections.find((item) => item.id === input.id)
  if (!section) throw new Error('Secao nao encontrada.')
  const nome = assertText(input.nome, 'Secao')
  const duplicate = data.sections.some(
    (item) => item.id !== input.id && item.organizationId === section.organizationId && item.nome === nome,
  )
  if (duplicate) throw new Error('Secao ja cadastrada para esta empresa.')
  const previousName = section.nome
  section.nome = nome
  section.updatedAt = nowIso()
  for (const employee of data.employees) {
    if (employee.organizationId === section.organizationId && employee.setor === previousName) {
      employee.setor = nome
      employee.updatedAt = section.updatedAt
    }
  }
  await saveLocalData(data)
  return section
}

export async function deleteSection(id: string): Promise<void> {
  const data = await loadLocalData()
  const section = data.sections.find((item) => item.id === id)
  if (!section) throw new Error('Secao nao encontrada.')
  const inUse = data.employees.some(
    (employee) => employee.organizationId === section.organizationId && employee.setor === section.nome,
  )
  if (inUse) throw new Error('Nao e possivel excluir uma secao em uso.')
  data.sections = data.sections.filter((item) => item.id !== id)
  await saveLocalData(data)
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const data = await loadLocalData()
  if (!data.organizations.some((item) => item.id === input.organizationId)) {
    throw new Error('Empresa nao encontrada para este funcionario.')
  }
  const setor = assertSectionForOrganization(data, input.organizationId, input.setor)
  const createdAt = nowIso()
  const employee: Employee = {
    id: createId(),
    organizationId: input.organizationId,
    nome: assertText(input.nome, 'Nome do funcionario'),
    setor,
    cargoFuncao: normalizeOptionalText(input.cargoFuncao),
    defaultSchedule: normalizeDefaultSchedule(input.defaultSchedule),
    createdAt,
    updatedAt: createdAt,
  }
  data.employees.push(employee)
  await saveLocalData(data)
  return employee
}

export async function updateEmployee(input: UpdateEmployeeInput): Promise<Employee> {
  const data = await loadLocalData()
  const employee = data.employees.find((item) => item.id === input.id)
  if (!employee) throw new Error('Funcionario nao encontrado.')
  employee.nome = assertText(input.nome, 'Nome do funcionario')
  employee.setor = assertSectionForOrganization(data, employee.organizationId, input.setor)
  const cargoFuncao = normalizeOptionalText(input.cargoFuncao)
  if (cargoFuncao) {
    employee.cargoFuncao = cargoFuncao
  } else {
    delete employee.cargoFuncao
  }
  const defaultSchedule = normalizeDefaultSchedule(input.defaultSchedule)
  if (defaultSchedule) {
    employee.defaultSchedule = defaultSchedule
  } else {
    delete employee.defaultSchedule
  }
  employee.updatedAt = nowIso()
  await saveLocalData(data)
  return employee
}

export async function deleteEmployee(id: string): Promise<void> {
  const data = await loadLocalData()
  const exists = data.employees.some((item) => item.id === id)
  if (!exists) throw new Error('Funcionario nao encontrado.')
  data.employees = data.employees.filter((item) => item.id !== id)
  await saveLocalData(data)
}
