import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { PontoHeader } from '../types/ponto'
import { generateTemplate } from './generateTemplate'

const header: PontoHeader = {
  empresa: 'Empresa Verde Ltda',
  nome: 'Ana Silva',
  secao: 'Portaria',
  mes: 3,
  ano: 2026,
}

describe('generateTemplate', () => {
  it('writes the selected organization name instead of a hardcoded company', async () => {
    const buffer = await generateTemplate(header)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]

    expect(sheet.getCell('A2').value).toBe('EMPRESA: Empresa Verde Ltda')
  })
})
