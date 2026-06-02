import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PontoTab, shouldShowNoEmployeesHint } from './PontoTab'
import type { Employee, Organization } from '../types/electron'

const organization: Organization = {
  id: 'org-1',
  nome: 'Empresa Azul',
  logoPath: '/tmp/logo.png',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const employee: Employee = {
  id: 'emp-1',
  organizationId: organization.id,
  nome: 'Ana Silva',
  setor: 'Portaria',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
}

describe('PontoTab', () => {
  it('shows an empty state when there are no organizations', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[]} employees={[]} />,
    )

    expect(html).toContain('Nenhuma empresa cadastrada')
    expect(html).toContain('Abra a aba Cadastros')
  })

  it('renders organization and employee selectors when data exists', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('Selecione uma empresa')
    expect(html).toContain('Empresa Azul')
    expect(html).toContain('Selecione um funcionário')
  })

  it('shows the no-employees hint only after an organization is selected', () => {
    expect(shouldShowNoEmployeesHint('', [])).toBe(false)
    expect(shouldShowNoEmployeesHint(organization.id, [])).toBe(true)
    expect(shouldShowNoEmployeesHint(organization.id, [employee])).toBe(false)
  })
})
