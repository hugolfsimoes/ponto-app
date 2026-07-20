import { describe, expect, it } from 'vitest'
import type { PontoRecord } from '../types/ponto'
import { validate } from './excelValidator'

function record(overrides: Partial<PontoRecord> = {}): PontoRecord {
  return {
    dia: 1,
    diaSemana: 'SEGUNDA',
    entrada: { hora: 8, minuto: 0 },
    inicioIntervalo: { hora: 12, minuto: 0 },
    fimIntervalo: { hora: 13, minuto: 0 },
    saida: { hora: 17, minuto: 0 },
    tipoDia: 'NORMAL',
    ...overrides,
  }
}

describe('excelValidator', () => {
  it('accepts overnight shifts when each time follows the previous one', () => {
    const errors = validate([
      record({
        entrada: { hora: 22, minuto: 0 },
        inicioIntervalo: { hora: 1, minuto: 0 },
        fimIntervalo: { hora: 2, minuto: 0 },
        saida: { hora: 6, minuto: 0 },
      }),
    ])

    expect(errors).toEqual([])
  })

  it('rejects equal consecutive times after overnight normalization', () => {
    const errors = validate([
      record({
        entrada: { hora: 22, minuto: 0 },
        inicioIntervalo: { hora: 1, minuto: 0 },
        fimIntervalo: { hora: 1, minuto: 0 },
        saida: { hora: 6, minuto: 0 },
      }),
    ])

    expect(errors[0]?.mensagem).toContain("'Início Intervalo' (01:00) e 'Fim Intervalo' (01:00) não podem ser iguais")
  })

  it('rejects shifts longer than 24 hours after overnight normalization', () => {
    const errors = validate([
      record({
        entrada: { hora: 14, minuto: 0 },
        inicioIntervalo: { hora: 12, minuto: 0 },
        fimIntervalo: { hora: 13, minuto: 0 },
        saida: { hora: 17, minuto: 0 },
      }),
    ])

    expect(errors[0]?.mensagem).toContain('excede 24 horas')
  })

  it('skips required-field validation for folga and feriado days', () => {
    const errors = validate([
      record({
        tipoDia: 'FOLGA',
        entrada: null,
        inicioIntervalo: null,
        fimIntervalo: null,
        saida: null,
      }),
      record({
        dia: 2,
        tipoDia: 'FERIADO',
        entrada: null,
        inicioIntervalo: null,
        fimIntervalo: null,
        saida: null,
      }),
    ])

    expect(errors).toEqual([])
  })
})
