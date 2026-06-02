import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('generatePdf layout', () => {
  it('uses a larger configured logo width in the PDF header', () => {
    const source = readFileSync(join(process.cwd(), 'backend/services/generatePdf.ts'), 'utf-8')

    expect(source).toMatch(/const LOGO_WIDTH = 60/)
    expect(source).toMatch(/width:\s*LOGO_WIDTH/)
    expect(source).not.toMatch(/width:\s*30/)
  })

  it('prints sector and function together in the employee header', () => {
    const source = readFileSync(join(process.cwd(), 'backend/services/generatePdf.ts'), 'utf-8')

    expect(source).toContain('SETOR / FUNÇÃO')
    expect(source).toContain('formatSetorFuncao')
  })

  it('keeps generated spreadsheets compatible with sector and function headers', () => {
    const templateSource = readFileSync(
      join(process.cwd(), 'backend/services/generateTemplate.ts'),
      'utf-8',
    )
    const excelSource = readFileSync(
      join(process.cwd(), 'backend/services/processExcel.ts'),
      'utf-8',
    )

    expect(templateSource).toContain('SETOR / FUNÇÃO')
    expect(excelSource).toContain('parseSetorFuncao')
  })
})
