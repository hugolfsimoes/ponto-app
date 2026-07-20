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
  createSection,
  deleteOrganization,
  deleteSection,
  getDataFilePath,
  loadLocalData,
  saveLocalData,
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
      sections: [],
      employees: [],
    })

    await expect(fs.access(getDataFilePath())).resolves.toBeUndefined()
  })

  it('writes data to a temporary file and renames it into place instead of overwriting directly', async () => {
    const dataFilePath = getDataFilePath()
    const writeSpy = vi.spyOn(fs, 'writeFile')
    const renameSpy = vi.spyOn(fs, 'rename')

    await saveLocalData({ version: 1, organizations: [], sections: [], employees: [] })

    const writesToFinalPath = writeSpy.mock.calls.filter(([path]) => path === dataFilePath)
    expect(writesToFinalPath).toHaveLength(0)

    const renamesIntoFinalPath = renameSpy.mock.calls.filter(([, dest]) => dest === dataFilePath)
    expect(renamesIntoFinalPath.length).toBeGreaterThan(0)

    writeSpy.mockRestore()
    renameSpy.mockRestore()

    await expect(loadLocalData()).resolves.toMatchObject({ organizations: [] })
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
    await createSection({
      organizationId: organization.id,
      nome: 'Portaria',
    })
    await createEmployee({
      organizationId: organization.id,
      nome: 'Ana',
      setor: 'Portaria',
    })

    await deleteOrganization(organization.id)

    const data = await loadLocalData()
    expect(data.organizations).toHaveLength(0)
    expect(data.sections).toHaveLength(0)
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

  it('creates sections per organization and requires employees to use a registered section', async () => {
    const organization = await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    const otherOrganization = await createOrganization({
      nome: 'Empresa Verde',
      logoSourcePath: await createLogo('verde.png'),
    })

    const section = await createSection({
      organizationId: organization.id,
      nome: 'Portaria',
    })
    await createSection({
      organizationId: otherOrganization.id,
      nome: 'Administrativo',
    })

    await expect(
      createEmployee({
        organizationId: organization.id,
        nome: 'Ana',
        setor: 'Administrativo',
      }),
    ).rejects.toThrow('Secao nao encontrada para esta empresa.')

    const employee = await createEmployee({
      organizationId: organization.id,
      nome: 'Ana',
      setor: section.nome,
    })

    expect(employee.setor).toBe('Portaria')
  })

  it('stores optional default schedules on employees', async () => {
    const organization = await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    await createSection({
      organizationId: organization.id,
      nome: 'Portaria',
    })

    const employee = await createEmployee({
      organizationId: organization.id,
      nome: 'Ana',
      setor: 'Portaria',
      defaultSchedule: {
        entrada: '07:30',
        inicioIntervalo: '11:30',
        fimIntervalo: '12:30',
        saida: '16:30',
      },
    })

    expect(employee.defaultSchedule).toEqual({
      entrada: '07:30',
      inicioIntervalo: '11:30',
      fimIntervalo: '12:30',
      saida: '16:30',
    })
  })

  it('stores optional employee role/function text', async () => {
    const organization = await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    await createSection({
      organizationId: organization.id,
      nome: 'Portaria',
    })

    const employee = await createEmployee({
      organizationId: organization.id,
      nome: 'Ana',
      setor: 'Portaria',
      cargoFuncao: '  Auxiliar Administrativo  ',
    })

    expect(employee.cargoFuncao).toBe('Auxiliar Administrativo')
  })

  it('rejects incomplete employee default schedules', async () => {
    const organization = await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    await createSection({
      organizationId: organization.id,
      nome: 'Portaria',
    })

    await expect(
      createEmployee({
        organizationId: organization.id,
        nome: 'Ana',
        setor: 'Portaria',
        defaultSchedule: {
          entrada: '07:30',
          inicioIntervalo: '',
          fimIntervalo: '12:30',
          saida: '16:30',
        },
      }),
    ).rejects.toThrow('Preencha todos os horarios padrao ou deixe todos em branco.')
  })

  it('deletes a section only when no employee uses it', async () => {
    const organization = await createOrganization({
      nome: 'Empresa Azul',
      logoSourcePath: await createLogo(),
    })
    const section = await createSection({
      organizationId: organization.id,
      nome: 'Portaria',
    })
    await createEmployee({
      organizationId: organization.id,
      nome: 'Ana',
      setor: section.nome,
    })

    await expect(deleteSection(section.id)).rejects.toThrow(
      'Nao e possivel excluir uma secao em uso.',
    )
  })
})
