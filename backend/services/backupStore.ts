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
    sections?: unknown[]
    employees?: unknown[]
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.organizations) || !Array.isArray(parsed.employees)) {
    throw new Error('Backup invalido: formato de dados nao reconhecido.')
  }
  if (!Array.isArray(parsed.sections)) parsed.sections = []

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

  // Troca atomica: o diretorio atual e renomeado para um caminho de backup
  // antes de mover os dados novos para o lugar. Se a segunda renomeacao
  // falhar, os dados atuais sao restaurados a partir do backup em vez de
  // ficarem apagados sem os novos terem sido copiados com sucesso.
  const previousDir = `${getDataDir()}-prev-${Date.now()}`
  let hadPrevious = false
  try {
    await fs.rename(getDataDir(), previousDir)
    hadPrevious = true
  } catch {
    // Sem diretorio atual (primeira execucao) - nada para preservar.
  }

  try {
    await fs.rename(tempDir, getDataDir())
  } catch (err) {
    if (hadPrevious) await fs.rename(previousDir, getDataDir())
    throw err
  }

  if (hadPrevious) await fs.rm(previousDir, { recursive: true, force: true })
}
