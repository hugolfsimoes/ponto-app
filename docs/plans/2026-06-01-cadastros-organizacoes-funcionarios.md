# Cadastros de Organizacoes e Funcionarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local organization and employee management, use selected organization/employee data in the point workflow, and support backup/restore for moving computers.

**Architecture:** Store structured data in a JSON file under Electron `app.getPath('userData')`, copy organization logos into a managed `logos/` directory, and expose all persistence through preload-safe IPC APIs. The renderer becomes a two-tab React UI: one tab for generating point files and one tab for managing organizations, employees, and backups.

**Tech Stack:** Electron, React, TypeScript, Node `fs/promises`, existing Excel/PDF services, plus a ZIP library such as `adm-zip` for backup export/import.

---

## File Structure

- Create `backend/types/cadastros.ts`: shared local-data types and input contracts.
- Create `backend/services/localDataStore.ts`: pure-ish Node service for loading, saving, validating, copying logos, and CRUD operations.
- Create `backend/services/backupStore.ts`: backup export/import service using ZIP files.
- Modify `backend/services/generateTemplate.ts`: accept organization-specific logo buffer from caller as it already does; keep template generation business logic unchanged.
- Modify `backend/services/generatePdf.ts`: keep accepting optional logo buffer; caller chooses the organization logo.
- Modify `src/main/ipc/handlers.ts`: add IPC handlers for local data, logo selection, backup, and updated template/PDF payloads.
- Modify `src/preload/index.ts`: expose new safe APIs.
- Modify `src/renderer/types/electron.d.ts`: add types for organizations, employees, local data, backup results, and new API signatures.
- Create `src/renderer/components/Tabs.tsx`: small tab switcher.
- Create `src/renderer/components/PontoTab.tsx`: current point workflow adapted to dropdowns.
- Create `src/renderer/components/CadastrosTab.tsx`: organization, employee, and backup management.
- Modify `src/renderer/components/TemplateForm.tsx`: either split logic into the new tabs or replace contents with tab orchestration.
- Modify `src/renderer/App.tsx`: keep rendering the top-level form/shell.
- Create: `resources/pontoapp.png`: app identity image copied from existing `src/assets/img/appImage.png` for packaging.
- Use: `src/assets/img/appImage.png`: renderer-accessible app identity image already added by the user.
- Modify `electron-builder.yml`: configure build icon/assets for the Ponto App identity when supported by the target.
- Modify `src/renderer/styles/global.css`: apply the Ponto App visual system.
- Modify `package.json`: add ZIP dependency for backup.

## Task 1: Add Types and ZIP Dependency

**Files:**
- Create: `backend/types/cadastros.ts`
- Modify: `src/renderer/types/electron.d.ts`
- Modify: `package.json`

- [x] **Step 1: Add the ZIP dependency**

Run:

```bash
pnpm add adm-zip
pnpm add -D @types/adm-zip
```

Expected: `package.json` and `pnpm-lock.yaml` include `adm-zip` and `@types/adm-zip`.

- [x] **Step 2: Create shared cadastro types**

Add `backend/types/cadastros.ts`:

```ts
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

export interface CreateOrganizationInput {
  nome: string
  logoSourcePath: string
}

export interface UpdateOrganizationInput {
  id: string
  nome: string
  logoSourcePath?: string
}

export interface CreateEmployeeInput {
  organizationId: string
  nome: string
  setor: string
}

export interface UpdateEmployeeInput {
  id: string
  nome: string
  setor: string
}

export interface OperationResult {
  success: boolean
  error?: string
}
```

- [x] **Step 3: Mirror renderer API types**

Update `src/renderer/types/electron.d.ts` with equivalent `Organization`, `Employee`, `LocalData`, CRUD result types, and these `PontoAPI` methods:

```ts
loadLocalData: () => Promise<LocalData>
selectLogoFile: () => Promise<{ canceled?: boolean; filePath?: string }>
createOrganization: (input: { nome: string; logoSourcePath: string }) => Promise<Organization>
updateOrganization: (input: { id: string; nome: string; logoSourcePath?: string }) => Promise<Organization>
deleteOrganization: (id: string) => Promise<{ success: boolean; error?: string }>
createEmployee: (input: { organizationId: string; nome: string; setor: string }) => Promise<Employee>
updateEmployee: (input: { id: string; nome: string; setor: string }) => Promise<Employee>
deleteEmployee: (id: string) => Promise<{ success: boolean; error?: string }>
exportBackup: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
importBackup: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>
```

Also change:

```ts
generateTemplate: (input: { header: PontoHeader; logoPath?: string }) => Promise<TemplateResult>
generatePdf: (input: { data: unknown; logoPath?: string }) => Promise<PdfResult>
```

- [x] **Step 4: Run typecheck/build**

Run:

```bash
pnpm build
```

Expected: build may fail until later tasks if signatures are not yet wired. Record exact TypeScript errors and resolve them in the following IPC/UI tasks.

- [x] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml backend/types/cadastros.ts src/renderer/types/electron.d.ts
git commit -m "feat: add cadastro data contracts"
```

## Task 2: Implement Local Data Store

**Files:**
- Create: `backend/services/localDataStore.ts`

- [x] **Step 1: Add the store service**

Create `backend/services/localDataStore.ts`:

```ts
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
```

- [x] **Step 2: Build**

Run:

```bash
pnpm build
```

Expected: store compiles, remaining errors may be from API signature mismatches until handlers/UI are updated.

- [x] **Step 3: Commit**

```bash
git add backend/services/localDataStore.ts
git commit -m "feat: add local cadastro store"
```

## Task 3: Implement Backup Store

**Files:**
- Create: `backend/services/backupStore.ts`

- [x] **Step 1: Add backup service**

Create `backend/services/backupStore.ts`:

```ts
import AdmZip from 'adm-zip'
import { promises as fs } from 'fs'
import { join } from 'path'
import { getDataDir, getDataFilePath, getLogosDir, loadLocalData } from './localDataStore'

export async function exportBackupToFile(targetPath: string): Promise<void> {
  await loadLocalData()
  const zip = new AdmZip()
  zip.addLocalFile(getDataFilePath(), '', 'dados.json')
  try {
    zip.addLocalFolder(getLogosDir(), 'logos')
  } catch {
    // Backup is still valid if no logos folder exists, but normal app data should create it.
  }
  zip.writeZip(targetPath)
}

export async function importBackupFromFile(sourcePath: string): Promise<void> {
  const zip = new AdmZip(sourcePath)
  const dataEntry = zip.getEntry('dados.json')
  if (!dataEntry) throw new Error('Backup invalido: dados.json nao encontrado.')

  const raw = dataEntry.getData().toString('utf-8')
  const parsed = JSON.parse(raw) as { version?: number; organizations?: Array<{ logoPath?: string }>; employees?: unknown[] }
  if (parsed.version !== 1 || !Array.isArray(parsed.organizations) || !Array.isArray(parsed.employees)) {
    throw new Error('Backup invalido: formato de dados nao reconhecido.')
  }

  const tempDir = `${getDataDir()}-import`
  await fs.rm(tempDir, { recursive: true, force: true })
  await fs.mkdir(tempDir, { recursive: true })
  zip.extractAllTo(tempDir, true)

  const importedLogosDir = join(tempDir, 'logos')
  for (const organization of parsed.organizations) {
    if (!organization.logoPath) throw new Error('Backup invalido: empresa sem logo.')
    const logoFileName = organization.logoPath.split(/[\\/]/).pop()
    if (!logoFileName) throw new Error('Backup invalido: caminho de logo invalido.')
    try {
      await fs.access(join(importedLogosDir, logoFileName))
    } catch {
      throw new Error(`Backup invalido: logo ${logoFileName} nao encontrada.`)
    }
    organization.logoPath = join(getLogosDir(), logoFileName)
  }

  await fs.writeFile(join(tempDir, 'dados.json'), JSON.stringify(parsed, null, 2), 'utf-8')
  await fs.rm(getDataDir(), { recursive: true, force: true })
  await fs.mkdir(getDataDir(), { recursive: true })
  await fs.cp(tempDir, getDataDir(), { recursive: true })
  await fs.rm(tempDir, { recursive: true, force: true })
}
```

- [x] **Step 2: Build**

Run:

```bash
pnpm build
```

Expected: backup service compiles.

- [x] **Step 3: Commit**

```bash
git add backend/services/backupStore.ts
git commit -m "feat: add cadastro backup store"
```

## Task 4: Wire IPC and Preload APIs

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`

- [x] **Step 1: Import services in IPC handlers**

Add imports to `src/main/ipc/handlers.ts`:

```ts
import {
  createEmployee,
  createOrganization,
  deleteEmployee,
  deleteOrganization,
  loadLocalData,
  updateEmployee,
  updateOrganization,
} from '../../../backend/services/localDataStore'
import { exportBackupToFile, importBackupFromFile } from '../../../backend/services/backupStore'
```

- [x] **Step 2: Add a helper to read organization logo**

Add near `loadLogo()`:

```ts
async function loadLogoFromPath(logoPath?: string): Promise<Buffer | undefined> {
  if (!logoPath) return loadLogo()
  try {
    return await fs.readFile(logoPath)
  } catch {
    return loadLogo()
  }
}
```

- [x] **Step 3: Update template handler payload**

Replace the first lines of the `generate-template` handler with:

```ts
ipcMain.handle('generate-template', async (event, input: PontoHeader | { header: PontoHeader; logoPath?: string }) => {
  const data = 'header' in input ? input.header : input
  const logoPath = 'header' in input ? input.logoPath : undefined
  const erros = validateHeader(data)
```

Then change logo loading inside that handler to:

```ts
const logoBuffer = await loadLogoFromPath(logoPath)
buffer = await generateTemplate(data, logoBuffer)
```

- [x] **Step 4: Update PDF handler payload**

Replace the first lines of the `generate-pdf` handler with:

```ts
ipcMain.handle('generate-pdf', async (event, input: PontoData | { data: PontoData; logoPath?: string }) => {
  const data = 'data' in input ? input.data : input
  const logoPath = 'data' in input ? input.logoPath : undefined
  if (!data || !data.header || !data.records) {
    return { success: false, error: 'Dados invalidos para geracao do PDF' }
  }
```

Then change logo loading inside that handler to:

```ts
const logoBuffer = await loadLogoFromPath(logoPath)
buffer = await generatePdf(data, logoBuffer)
```

- [x] **Step 5: Add cadastro IPC handlers**

Add inside `registerHandlers()`:

```ts
ipcMain.handle('load-local-data', async () => {
  try {
    return await loadLocalData()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { version: 1, organizations: [], employees: [], error: msg }
  }
})

ipcMain.handle('select-logo-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { filePaths, canceled } = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Selecionar Logo da Empresa',
    filters: [{ name: 'Imagem', extensions: ['png', 'jpg', 'jpeg'] }],
    properties: ['openFile'],
  })
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
```

- [x] **Step 6: Add backup IPC handlers**

Add inside `registerHandlers()`:

```ts
ipcMain.handle('export-backup', async (event) => {
  const date = new Date().toISOString().slice(0, 10)
  const win = BrowserWindow.fromWebContents(event.sender)
  const { filePath, canceled } = await dialog.showSaveDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Exportar Backup do PontoApp',
    defaultPath: `pontoapp-backup-${date}.zip`,
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
  })
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
  const { filePaths, canceled } = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    title: 'Importar Backup do PontoApp',
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return { success: false, canceled: true }
  try {
    await importBackupFromFile(filePaths[0])
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})
```

- [x] **Step 7: Expose preload methods**

Update `src/preload/index.ts` `pontoAPI`:

```ts
loadLocalData: (): Promise<unknown> => ipcRenderer.invoke('load-local-data'),
selectLogoFile: (): Promise<unknown> => ipcRenderer.invoke('select-logo-file'),
createOrganization: (input: unknown): Promise<unknown> => ipcRenderer.invoke('create-organization', input),
updateOrganization: (input: unknown): Promise<unknown> => ipcRenderer.invoke('update-organization', input),
deleteOrganization: (id: string): Promise<unknown> => ipcRenderer.invoke('delete-organization', id),
createEmployee: (input: unknown): Promise<unknown> => ipcRenderer.invoke('create-employee', input),
updateEmployee: (input: unknown): Promise<unknown> => ipcRenderer.invoke('update-employee', input),
deleteEmployee: (id: string): Promise<unknown> => ipcRenderer.invoke('delete-employee', id),
exportBackup: (): Promise<unknown> => ipcRenderer.invoke('export-backup'),
importBackup: (): Promise<unknown> => ipcRenderer.invoke('import-backup'),
```

- [x] **Step 8: Build**

Run:

```bash
pnpm build
```

Expected: IPC and preload compile. Any remaining errors should point to renderer components still using old signatures.

- [x] **Step 9: Commit**

```bash
git add src/main/ipc/handlers.ts src/preload/index.ts
git commit -m "feat: expose cadastro ipc APIs"
```

## Task 5: Split Renderer into Tabs

**Files:**
- Create: `src/renderer/components/Tabs.tsx`
- Create: `src/renderer/components/PontoTab.tsx`
- Create: `src/renderer/components/CadastrosTab.tsx`
- Modify: `src/renderer/components/TemplateForm.tsx`

- [x] **Step 1: Create tab switcher**

Add `src/renderer/components/Tabs.tsx`:

```tsx
import { JSX } from 'react'

export type AppTab = 'ponto' | 'cadastros'

interface TabsProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export function Tabs({ activeTab, onChange }: TabsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      <button type='button' onClick={() => onChange('ponto')} disabled={activeTab === 'ponto'}>
        Ponto
      </button>
      <button type='button' onClick={() => onChange('cadastros')} disabled={activeTab === 'cadastros'}>
        Cadastros
      </button>
    </div>
  )
}
```

- [x] **Step 2: Move current workflow into `PontoTab`**

Create `src/renderer/components/PontoTab.tsx` by moving the current state and handlers from `TemplateForm.tsx`, then replace `nome` and `secao` inputs with:

```tsx
<select
  value={selectedOrganizationId}
  onChange={(event) => {
    setSelectedOrganizationId(event.target.value)
    setSelectedEmployeeId('')
  }}
  disabled={isLoading}
>
  <option value=''>Selecione uma empresa</option>
  {organizations.map((organization) => (
    <option key={organization.id} value={organization.id}>
      {organization.nome}
    </option>
  ))}
</select>

<select
  value={selectedEmployeeId}
  onChange={(event) => setSelectedEmployeeId(event.target.value)}
  disabled={isLoading || !selectedOrganizationId}
>
  <option value=''>Selecione um funcionario</option>
  {employees
    .filter((employee) => employee.organizationId === selectedOrganizationId)
    .map((employee) => (
      <option key={employee.id} value={employee.id}>
        {employee.nome}
      </option>
    ))}
</select>

<input value={selectedEmployee?.setor ?? ''} readOnly placeholder='Setor' />
```

Compute:

```ts
const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId)
const selectedEmployee = employees.find((item) => item.id === selectedEmployeeId)
const podeGerarPlanilha = !isLoading && !!selectedOrganization && !!selectedEmployee
```

Call template generation with:

```ts
const header: PontoHeader = {
  empresa: selectedOrganization.nome,
  nome: selectedEmployee.nome,
  secao: selectedEmployee.setor,
  mes,
  ano: ANO_ATUAL,
}

const resultado = await window.pontoAPI.generateTemplate({
  header,
  logoPath: selectedOrganization.logoPath,
})
```

Call PDF generation with:

```ts
const resultado = await window.pontoAPI.generatePdf({
  data: excelData,
  logoPath: selectedOrganization?.logoPath,
})
```

- [x] **Step 3: Create `CadastrosTab`**

Create `src/renderer/components/CadastrosTab.tsx` with local form state:

```tsx
const [organizationName, setOrganizationName] = useState('')
const [organizationLogoPath, setOrganizationLogoPath] = useState('')
const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null)
const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
const [employeeName, setEmployeeName] = useState('')
const [employeeSetor, setEmployeeSetor] = useState('')
const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
const [message, setMessage] = useState('')
```

Implement actions:

```ts
async function chooseLogo(): Promise<void> {
  const result = await window.pontoAPI.selectLogoFile()
  if (!result.canceled && result.filePath) setOrganizationLogoPath(result.filePath)
}

async function saveOrganization(): Promise<void> {
  if (editingOrganizationId) {
    await window.pontoAPI.updateOrganization({
      id: editingOrganizationId,
      nome: organizationName,
      logoSourcePath: organizationLogoPath || undefined,
    })
  } else {
    await window.pontoAPI.createOrganization({
      nome: organizationName,
      logoSourcePath: organizationLogoPath,
    })
  }
  await onReload()
  setOrganizationName('')
  setOrganizationLogoPath('')
  setEditingOrganizationId(null)
}

async function removeOrganization(id: string): Promise<void> {
  if (!window.confirm('Excluir esta empresa e todos os funcionarios dela?')) return
  await window.pontoAPI.deleteOrganization(id)
  await onReload()
}

async function saveEmployee(): Promise<void> {
  if (editingEmployeeId) {
    await window.pontoAPI.updateEmployee({ id: editingEmployeeId, nome: employeeName, setor: employeeSetor })
  } else {
    await window.pontoAPI.createEmployee({ organizationId: selectedOrganizationId, nome: employeeName, setor: employeeSetor })
  }
  await onReload()
  setEmployeeName('')
  setEmployeeSetor('')
  setEditingEmployeeId(null)
}

async function removeEmployee(id: string): Promise<void> {
  if (!window.confirm('Excluir este funcionario?')) return
  await window.pontoAPI.deleteEmployee(id)
  await onReload()
}
```

Add backup actions:

```ts
async function exportBackup(): Promise<void> {
  const result = await window.pontoAPI.exportBackup()
  if (result.success) setMessage(`Backup exportado: ${result.filePath}`)
}

async function importBackup(): Promise<void> {
  if (!window.confirm('Importar backup vai substituir os dados atuais. Continuar?')) return
  const result = await window.pontoAPI.importBackup()
  if (result.success) {
    await onReload()
    setMessage('Backup importado com sucesso.')
  }
}
```

- [x] **Step 4: Orchestrate tabs in `TemplateForm`**

Replace `TemplateForm` internals with top-level data loading:

```tsx
const [activeTab, setActiveTab] = useState<AppTab>('ponto')
const [localData, setLocalData] = useState<LocalData>({ version: 1, organizations: [], employees: [] })

async function reloadLocalData(): Promise<void> {
  const data = await window.pontoAPI.loadLocalData()
  setLocalData(data)
}

useEffect(() => {
  void reloadLocalData()
}, [])
```

Render:

```tsx
<Tabs activeTab={activeTab} onChange={setActiveTab} />
{activeTab === 'ponto' ? (
  <PontoTab organizations={localData.organizations} employees={localData.employees} />
) : (
  <CadastrosTab data={localData} onReload={reloadLocalData} />
)}
```

- [x] **Step 5: Build**

Run:

```bash
pnpm build
```

Expected: renderer compiles with the new split components.

- [x] **Step 6: Commit**

```bash
git add src/renderer/components/Tabs.tsx src/renderer/components/PontoTab.tsx src/renderer/components/CadastrosTab.tsx src/renderer/components/TemplateForm.tsx
git commit -m "feat: add ponto and cadastro tabs"
```

## Task 6: Add App Branding and Visual Style

**Files:**
- Create: `resources/pontoapp.png`
- Use: `src/assets/img/appImage.png`
- Modify: `electron-builder.yml`
- Modify: `src/renderer/components/TemplateForm.tsx`
- Modify: `src/renderer/styles/global.css`
- Modify: `src/renderer/components/Tabs.tsx`
- Modify: `src/renderer/components/PontoTab.tsx`
- Modify: `src/renderer/components/CadastrosTab.tsx`

- [ ] **Step 1: Copy the existing app image into build resources**

Run:

```bash
cp src/assets/img/appImage.png resources/pontoapp.png
```

Expected: `resources/pontoapp.png` exists and contains the same Ponto App logo image as `src/assets/img/appImage.png`.

- [ ] **Step 2: Configure the build to use the app identity asset**

Update `electron-builder.yml` so each platform points at the Ponto App image where supported:

```yaml
win:
  executableName: PontoApp
  icon: resources/pontoapp.png
  signAndEditExecutable: false
  target:
    - portable

linux:
  target:
    - AppImage
    - deb
  icon: resources/pontoapp.png
  maintainer: electronjs.org
  category: Utility
```

Note: if Electron Builder requires `.ico` for Windows during verification, generate `resources/pontoapp.ico` from the PNG and change `win.icon` to that file.

- [ ] **Step 3: Replace fixed PROTMAX branding in the renderer shell**

In `src/renderer/components/TemplateForm.tsx`, import the new image:

```tsx
import pontoAppLogo from '../assets/img/appImage.png'
```

Render it in the main header instead of the PROTMAX image/title:

```tsx
<header className='app-header'>
  <img src={pontoAppLogo} alt='Ponto App' className='app-logo' />
  <div>
    <h1>Ponto App</h1>
    <p>Folha de ponto por empresa e funcionario</p>
  </div>
</header>
```

Keep organization logos out of this header; they are customer data and belong in generated Excel/PDF output.

- [ ] **Step 4: Apply the Ponto App visual system**

Update `src/renderer/styles/global.css` with these base tokens and layout styles:

```css
:root {
  color: #082f63;
  background: #f7fbff;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  --brand-blue: #0b8ff2;
  --brand-blue-dark: #07346f;
  --text-main: #082f63;
  --text-muted: #5f6f84;
  --surface: #ffffff;
  --surface-border: #d9e6f5;
  --focus-ring: rgba(11, 143, 242, 0.28);
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f7fbff;
}

button,
select,
input {
  font: inherit;
}

button {
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--brand-blue);
  color: #ffffff;
  cursor: pointer;
  min-height: 40px;
  padding: 0 14px;
}

button:hover:not(:disabled) {
  background: #087bd1;
}

button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

input,
select {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-main);
  min-height: 40px;
  padding: 0 12px;
}

.app-shell {
  max-width: 980px;
  margin: 0 auto;
  padding: 32px 20px;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.app-logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
}
```

- [ ] **Step 5: Keep tab styling consistent with the brand**

In `src/renderer/components/Tabs.tsx`, use class names instead of bare disabled buttons:

```tsx
<div className='tabs' role='tablist' aria-label='Navegacao principal'>
  <button type='button' className={activeTab === 'ponto' ? 'tab active' : 'tab'} onClick={() => onChange('ponto')}>
    Ponto
  </button>
  <button type='button' className={activeTab === 'cadastros' ? 'tab active' : 'tab'} onClick={() => onChange('cadastros')}>
    Cadastros
  </button>
</div>
```

Add styles:

```css
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.tab {
  background: #ffffff;
  border-color: var(--surface-border);
  color: var(--text-main);
}

.tab.active {
  background: var(--brand-blue-dark);
  border-color: var(--brand-blue-dark);
  color: #ffffff;
}
```

- [ ] **Step 6: Build**

Run:

```bash
pnpm build
```

Expected: build passes, renderer uses the new Ponto App image, and no asset import errors occur.

- [ ] **Step 7: Commit**

```bash
git add resources/pontoapp.png src/assets/img/appImage.png electron-builder.yml src/renderer/components/TemplateForm.tsx src/renderer/components/Tabs.tsx src/renderer/components/PontoTab.tsx src/renderer/components/CadastrosTab.tsx src/renderer/styles/global.css
git commit -m "feat: apply ponto app branding"
```

## Task 7: Polish UI States and Error Handling

**Files:**
- Modify: `src/renderer/components/PontoTab.tsx`
- Modify: `src/renderer/components/CadastrosTab.tsx`
- Modify: `src/renderer/styles/global.css` if shared styling is preferred over inline styles.

- [ ] **Step 1: Add empty state in Ponto tab**

In `PontoTab`, render a clear empty state when `organizations.length === 0`:

```tsx
if (organizations.length === 0) {
  return <p>Nenhuma empresa cadastrada. Abra a aba Cadastros para adicionar a primeira empresa.</p>
}
```

When an organization has no employees:

```tsx
{selectedOrganizationId && filteredEmployees.length === 0 && (
  <p>Esta empresa ainda nao tem funcionarios cadastrados.</p>
)}
```

- [ ] **Step 2: Surface backend errors in Cadastro tab**

After each create/update/delete call, check whether the returned object has `error`:

```ts
if ('error' in result && result.error) {
  setMessage(result.error)
  return
}
```

- [ ] **Step 3: Disable invalid submit buttons**

Disable save organization unless:

```ts
const canSaveOrganization = organizationName.trim() !== '' && (editingOrganizationId !== null || organizationLogoPath.trim() !== '')
```

Disable save employee unless:

```ts
const canSaveEmployee = selectedOrganizationId !== '' && employeeName.trim() !== '' && employeeSetor.trim() !== ''
```

- [ ] **Step 4: Build**

Run:

```bash
pnpm build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/PontoTab.tsx src/renderer/components/CadastrosTab.tsx src/renderer/styles/global.css
git commit -m "feat: polish cadastro workflow states"
```

## Task 8: Manual End-to-End Verification

**Files:**
- No required source changes unless verification finds defects.

- [ ] **Step 1: Run the app**

Run:

```bash
pnpm dev
```

Expected: Electron opens without preload or IPC errors.

- [ ] **Step 2: Verify cadastro flow**

Manual checks:

- Create Empresa A with a PNG/JPG/JPEG logo.
- Create Empresa B with a different logo.
- Edit Empresa A name.
- Add two employees to Empresa A with different setores.
- Add one employee to Empresa B.
- Delete one employee after confirmation.
- Delete Empresa B after confirmation and verify its employees disappear.

- [ ] **Step 3: Verify point flow**

Manual checks:

- Select Empresa A.
- Confirm employee dropdown shows only Empresa A employees.
- Select an employee.
- Confirm setor is auto-filled and read-only.
- Generate Excel and open it.
- Confirm company name, employee name, setor, month, and logo are correct.
- Process the generated Excel.
- Generate PDF.
- Confirm company name, employee name, setor, totals, and logo are correct.

- [ ] **Step 4: Verify backup flow**

Manual checks:

- Export backup.
- In a development-only test, temporarily move the `pontoapp-data` folder away from `app.getPath('userData')`.
- Relaunch the app and confirm it starts empty.
- Import the backup.
- Confirm organizations, employees, and logos are restored.

- [ ] **Step 5: Verify app branding**

Manual checks:

- Confirm the app header shows the Ponto App image, not the old PROTMAX image.
- Confirm buttons, tabs, inputs, and page background follow the blue/navy/white visual direction from the provided image.
- Confirm generated Excel/PDF files still use the selected organization logo, not the app logo.
- Confirm the packaged app/build icon uses the Ponto App image where supported by the target platform.

- [ ] **Step 6: Final build**

Run:

```bash
pnpm build
```

Expected: build passes.

- [ ] **Step 7: Commit verification fixes**

If verification required fixes:

```bash
git add <fixed-files>
git commit -m "fix: complete cadastro verification"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: organizations, required logos, employee CRUD, dropdown filtering, automatic setor, local JSON persistence, backup export/import, app branding, visual style, and confirmation before destructive actions are all covered by tasks.
- Placeholder scan: no unresolved placeholders, unscoped "handle later", or missing task bodies remain.
- Type consistency: entities use `Organization`, `Employee`, and `LocalData`; renderer API names match IPC channel names and backend service names.
