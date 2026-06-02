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
  const parsed = JSON.parse(raw) as {
    version?: number
    organizations?: Array<{ logoPath?: string }>
    employees?: unknown[]
  }
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
