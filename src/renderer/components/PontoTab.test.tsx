import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  PontoTab,
  resolveEmployeeDefaultSchedule,
  shouldShowNoEmployeesHint,
} from './PontoTab'
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

  it('renders the in-app editor actions', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('Aplicar horário padrão')
    expect(html).toContain('Gerar PDF')
    expect(html).toContain('Usar planilha Excel')
  })

  it('renders separate Folga and Feriado columns in the editor grid', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('<span>Folga</span>')
    expect(html).toContain('<span>Feriado</span>')
  })

  it('uses an employee default schedule when available', () => {
    expect(
      resolveEmployeeDefaultSchedule({
        ...employee,
        defaultSchedule: {
          entrada: '07:30',
          inicioIntervalo: '11:30',
          fimIntervalo: '12:30',
          saida: '16:30',
        },
      }),
    ).toEqual({
      entrada: '07:30',
      inicioIntervalo: '11:30',
      fimIntervalo: '12:30',
      saida: '16:30',
    })

    expect(resolveEmployeeDefaultSchedule(employee)).toEqual({
      entrada: '08:00',
      inicioIntervalo: '12:00',
      fimIntervalo: '13:00',
      saida: '17:00',
    })
  })

  it('renders the horario font size selector with a default of 10', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('Tamanho da fonte dos horários')
    expect(html).toContain('<option value="10" selected="">10pt</option>')
  })

  it('uses the employee role/function in the manual PDF header source', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/renderer/components/PontoTab.tsx'),
      'utf-8',
    )

    expect(source).toContain('funcao: selectedEmployee.cargoFuncao')
  })
})
