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

  it('applies a custom horarioFontSize to the time columns only', () => {
    const source = readFileSync(join(process.cwd(), 'backend/services/generatePdf.ts'), 'utf-8')

    expect(source).toMatch(/options\?\.horarioFontSize\s*\?\?\s*10/)
    expect(source).toMatch(/options\?:\s*\{\s*horarioFontSize\?:\s*number\s*\}/)
  })
})
