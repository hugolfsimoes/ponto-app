import { app } from 'electron'
import { promises as fs } from 'fs'
import { dirname, extname, join } from 'path'
import type {
  CreateEmployeeInput,
  CreateOrganizationInput,
  Employee,
  LocalData,
  Organization,
  UpdateEmployeeInput,
  UpdateOrganizationInput,
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
  return { version: 1, organizations: [], employees: [] }
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
  return parsed
}

export async function saveLocalData(data: LocalData): Promise<void> {
  await fs.mkdir(dirname(getDataFilePath()), { recursive: true })
  await fs.writeFile(getDataFilePath(), JSON.stringify(data, null, 2), 'utf-8')
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
  data.employees = data.employees.filter((item) => item.organizationId !== id)
  await saveLocalData(data)
  await removeFileIfExists(organization.logoPath)
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const data = await loadLocalData()
  if (!data.organizations.some((item) => item.id === input.organizationId)) {
    throw new Error('Empresa nao encontrada para este funcionario.')
  }
  const createdAt = nowIso()
  const employee: Employee = {
    id: createId(),
    organizationId: input.organizationId,
    nome: assertText(input.nome, 'Nome do funcionario'),
    setor: assertText(input.setor, 'Setor'),
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
  employee.setor = assertText(input.setor, 'Setor')
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
