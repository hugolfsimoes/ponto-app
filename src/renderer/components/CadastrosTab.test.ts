import { createElement } from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CadastrosTab,
  getBackendErrorMessage,
  getSectionDeletionWarning,
  isSectionInUse,
} from './CadastrosTab'

describe('getBackendErrorMessage', () => {
  it('returns backend error text when a CRUD result includes an error', () => {
    expect(getBackendErrorMessage({ error: 'Logo inválida.' })).toBe(
      'Logo inválida.',
    )
  })

  it('returns null when a CRUD result has no backend error', () => {
    expect(getBackendErrorMessage({ success: true })).toBeNull()
  })
})

describe('isSectionInUse', () => {
  it('detects sections used by employees in the same organization', () => {
    expect(
      isSectionInUse(
        { id: 'section-1', organizationId: 'org-1', nome: 'Operação' },
        [
          {
            id: 'emp-1',
            organizationId: 'org-1',
            nome: 'Funcionário A',
            setor: 'Operação',
          },
        ],
      ),
    ).toBe(true)

    expect(
      isSectionInUse(
        { id: 'section-1', organizationId: 'org-1', nome: 'Operação' },
        [
          {
            id: 'emp-2',
            organizationId: 'org-2',
            nome: 'Funcionário B',
            setor: 'Operação',
          },
        ],
      ),
    ).toBe(false)
  })
})

describe('getSectionDeletionWarning', () => {
  it('returns a visible warning when a section has employees', () => {
    expect(
      getSectionDeletionWarning(
        { id: 'section-1', organizationId: 'org-1', nome: 'Operação' },
        [
          {
            id: 'emp-1',
            organizationId: 'org-1',
            nome: 'Funcionário A',
            setor: 'Operação',
          },
        ],
      ),
    ).toBe('Não é possível excluir seção que tenha funcionário cadastrado.')
  })
})

describe('section deletion warning UI', () => {
  it('shows a browser alert before returning when a section is in use', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/renderer/components/CadastrosTab.tsx'),
      'utf-8',
    )

    expect(source).toMatch(/if \(warning\) \{[\s\S]*window\.alert\(warning\)[\s\S]*return/)
  })
})

describe('section editing UI', () => {
  it('supports editing existing sections through the section form', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/renderer/components/CadastrosTab.tsx'),
      'utf-8',
    )

    expect(source).toContain('editingSectionId')
    expect(source).toContain('window.pontoAPI.updateSection')
    expect(source).toContain('Salvar seção')
  })
})

describe('CadastrosTab layout', () => {
  it('renders companies on the left and employees on the right with backup below', () => {
    const html = renderToStaticMarkup(
      createElement(CadastrosTab, {
        data: {
          organizations: [
            { id: 'org-1', nome: 'Empresa A', logoPath: '/logos/a.png' },
          ],
          sections: [
            {
              id: 'section-1',
              organizationId: 'org-1',
              nome: 'Operação',
              createdAt: '2026-06-02T00:00:00.000Z',
              updatedAt: '2026-06-02T00:00:00.000Z',
            },
          ],
          employees: [
            {
              id: 'emp-1',
              organizationId: 'org-1',
              nome: 'Funcionário A',
              setor: 'Operação',
            },
          ],
        },
        onReload: async () => undefined,
      }),
    )

    expect(html).toContain('class="cadastros-layout"')
    expect(html).toContain('class="cadastros-panel cadastros-empresas-panel"')
    expect(html).toContain('class="cadastros-panel cadastros-funcionarios-panel"')
    expect(html).toContain('class="cadastros-footer"')
    expect(html).toContain('Seções')
    expect(html).toContain('Cadastrar seção')
    expect(html).toContain('Editar')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('<select')
    expect(html).not.toContain('Selecione uma empresa')
    expect(html).toContain('Selecione uma seção')
    expect(html).toContain('Entrada padrão')
    expect(html).toContain('Início intervalo padrão')
    expect(html).toContain('Fim intervalo padrão')
    expect(html).toContain('Saída padrão')
  })
})
