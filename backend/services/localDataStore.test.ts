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

import {
  createEmployee,
  createOrganization,
  deleteOrganization,
  getDataFilePath,
  loadLocalData,
} from './localDataStore'

async function createLogo(name = 'logo.png'): Promise<string> {
  const logoPath = join(mockPaths.userDataDir, name)
  await fs.mkdir(mockPaths.userDataDir, { recursive: true })
  await fs.writeFile(logoPath, 'image-bytes')
  return logoPath
}

describe('localDataStore', () => {
  beforeEach(async () => {
    mockPaths.userDataDir = await fs.mkdtemp(join(tmpdir(), 'pontoapp-store-'))
  })

  afterEach(async () => {
    await fs.rm(mockPaths.userDataDir, { recursive: true, force: true })
  })

  it('creates an empty local data file when the store does not exist', async () => {
    await expect(loadLocalData()).resolves.toEqual({
      version: 1,
      organizations: [],
      employees: [],
    })

    await expect(fs.access(getDataFilePath())).resolves.toBeUndefined()
  })

  it('creates an organization and copies its logo into managed storage', async () => {
    const sourceLogo = await createLogo()

    const organization = await createOrganization({
      nome: '  Empresa Azul  ',
      logoSourcePath: sourceLogo,
    })

    expect(organization.nome).toBe('Empresa Azul')
    expect(organization.logoPath).toContain('pontoapp-data/logos/')
    await expect(fs.readFile(organization.logoPath, 'utf-8')).resolves.toBe(
      'image-bytes',
    )
  })

  it('rejects organization logos with unsupported extensions', async () => {
    const sourceLogo = await createLogo('logo.gif')

    await expect(
      createOrganization({
        nome: 'Empresa Azul',
        logoSourcePath: sourceLogo,
      }),
    ).rejects.toThrow('A logo deve ser PNG, JPG ou JPEG.')
  })

  it('deletes an organization, its employees, and its managed logo', async () => {
    const organization = await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    await createEmployee({
      organizationId: organization.id,
      nome: 'Ana',
      setor: 'Portaria',
    })

    await deleteOrganization(organization.id)

    const data = await loadLocalData()
    expect(data.organizations).toHaveLength(0)
    expect(data.employees).toHaveLength(0)
    await expect(fs.access(organization.logoPath)).rejects.toThrow()
  })

  it('rejects employees for missing organizations', async () => {
    await expect(
      createEmployee({
        organizationId: 'missing',
        nome: 'Ana',
        setor: 'Portaria',
      }),
    ).rejects.toThrow('Empresa nao encontrada para este funcionario.')
  })
})
