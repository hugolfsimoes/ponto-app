import AdmZip from 'adm-zip'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockPaths = vi.hoisted(() => ({
  userDataDir: '',
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockPaths.userDataDir),
  },
}))

import { createOrganization, loadLocalData } from './localDataStore'
import { exportBackupToFile, importBackupFromFile } from './backupStore'

async function createLogo(name = 'logo.png'): Promise<string> {
  const logoPath = join(mockPaths.userDataDir, name)
  await fs.mkdir(mockPaths.userDataDir, { recursive: true })
  await fs.writeFile(logoPath, 'image-bytes')
  return logoPath
}

function writeZip(path: string, entries: Record<string, string>): void {
  const zip = new AdmZip()
  for (const [entryName, content] of Object.entries(entries)) {
    zip.addFile(entryName, Buffer.from(content, 'utf-8'))
  }
  zip.writeZip(path)
}

describe('backupStore', () => {
  beforeEach(async () => {
    mockPaths.userDataDir = await fs.mkdtemp(join(tmpdir(), 'pontoapp-backup-'))
  })

  afterEach(async () => {
    await fs.rm(mockPaths.userDataDir, { recursive: true, force: true })
  })

  it('exports a zip containing dados.json and managed logos', async () => {
    await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    const backupPath = join(mockPaths.userDataDir, 'backup.zip')

    await exportBackupToFile(backupPath)

    const zip = new AdmZip(backupPath)
    expect(zip.getEntry('dados.json')).not.toBeNull()
    expect(zip.getEntries().some((entry) => entry.entryName.startsWith('logos/'))).toBe(
      true,
    )
  })

  it('imports a valid backup and rewrites logo paths to the active data directory', async () => {
    const backupPath = join(mockPaths.userDataDir, 'backup.zip')
    const importedData = {
      version: 1,
      organizations: [
        {
          id: 'org-1',
          nome: 'Empresa Restaurada',
          logoPath: '/old/computer/org-1.png',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      employees: [],
    }
    writeZip(backupPath, {
      'dados.json': JSON.stringify(importedData),
      'logos/org-1.png': 'image-bytes',
    })

    await importBackupFromFile(backupPath)

    const data = await loadLocalData()
    expect(data.organizations[0].logoPath).toContain('pontoapp-data/logos/org-1.png')
    await expect(fs.readFile(data.organizations[0].logoPath, 'utf-8')).resolves.toBe(
      'image-bytes',
    )
  })

  it('preserves the existing data if moving the imported data into place fails', async () => {
    await createOrganization({
      nome: 'Empresa Original',
      logoSourcePath: await createLogo(),
    })

    const backupPath = join(mockPaths.userDataDir, 'backup.zip')
    writeZip(backupPath, {
      'dados.json': JSON.stringify({
        version: 1,
        organizations: [
          {
            id: 'org-2',
            nome: 'Empresa Restaurada',
            logoPath: '/old/computer/org-2.png',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        employees: [],
      }),
      'logos/org-2.png': 'image-bytes',
    })

    const originalRename = fs.rename.bind(fs)
    let renameCalls = 0
    const renameSpy = vi
      .spyOn(fs, 'rename')
      .mockImplementation(async (...args: Parameters<typeof fs.rename>) => {
        renameCalls += 1
        if (renameCalls === 2) throw new Error('disk full (simulated)')
        return originalRename(...args)
      })

    await expect(importBackupFromFile(backupPath)).rejects.toThrow(
      'disk full (simulated)',
    )
    renameSpy.mockRestore()

    const data = await loadLocalData()
    expect(data.organizations).toHaveLength(1)
    expect(data.organizations[0].nome).toBe('Empresa Original')
  })

  it('rejects backups without dados.json', async () => {
    const backupPath = join(mockPaths.userDataDir, 'missing-data.zip')
    writeZip(backupPath, {
      'logos/org-1.png': 'image-bytes',
    })

    await expect(importBackupFromFile(backupPath)).rejects.toThrow(
      'dados.json nao encontrado',
    )
  })

  it('rejects backups when an organization logo is missing', async () => {
    const backupPath = join(mockPaths.userDataDir, 'missing-logo.zip')
    writeZip(backupPath, {
      'dados.json': JSON.stringify({
        version: 1,
        organizations: [
          {
            id: 'org-1',
            nome: 'Empresa Restaurada',
            logoPath: '/old/computer/org-1.png',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        employees: [],
      }),
    })

    await expect(importBackupFromFile(backupPath)).rejects.toThrow(
      'logo org-1.png nao encontrada',
    )
  })
})
