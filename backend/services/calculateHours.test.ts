import { describe, expect, it } from 'vitest'
import type { PontoRecord } from '../types/ponto'
import { calculateHours } from './calculateHours'

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

describe('calculateHours', () => {
  it('subtracts the interval from the worked day', () => {
    expect(calculateHours(record())).toBe(480)
  })

  it('calculates worked minutes when the shift ends on the next day', () => {
    expect(
      calculateHours(
        record({
          entrada: { hora: 18, minuto: 0 },
          inicioIntervalo: { hora: 21, minuto: 0 },
          fimIntervalo: { hora: 22, minuto: 0 },
          saida: { hora: 4, minuto: 0 },
        }),
      ),
    ).toBe(540)
  })

  it('calculates worked minutes when the interval is after midnight', () => {
    expect(
      calculateHours(
        record({
          entrada: { hora: 22, minuto: 0 },
          inicioIntervalo: { hora: 1, minuto: 0 },
          fimIntervalo: { hora: 2, minuto: 0 },
          saida: { hora: 6, minuto: 0 },
        }),
      ),
    ).toBe(420)
  })

  it('returns zero for days off', () => {
    expect(calculateHours(record({ tipoDia: 'FOLGA' }))).toBe(0)
  })

  it('returns zero for feriado', () => {
    expect(calculateHours(record({ tipoDia: 'FERIADO' }))).toBe(0)
  })

  it('returns zero when a non-day-off record is incomplete', () => {
    expect(calculateHours(record({ saida: null }))).toBe(0)
  })

  it('throws when the normalized shift is longer than 24 hours', () => {
    expect(() =>
      calculateHours(
        record({
          entrada: { hora: 14, minuto: 0 },
          inicioIntervalo: { hora: 12, minuto: 0 },
          fimIntervalo: { hora: 13, minuto: 0 },
          saida: { hora: 17, minuto: 0 },
        }),
      ),
    ).toThrow('excede 24 horas')
  })
})
