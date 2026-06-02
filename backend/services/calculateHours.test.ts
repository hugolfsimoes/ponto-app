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
    folga: false,
    ...overrides,
  }
}

describe('calculateHours', () => {
  it('subtracts the interval from the worked day', () => {
    expect(calculateHours(record())).toBe(480)
  })

  it('returns zero for days off', () => {
    expect(calculateHours(record({ folga: true }))).toBe(0)
  })

  it('returns zero when a non-day-off record is incomplete', () => {
    expect(calculateHours(record({ saida: null }))).toBe(0)
  })

  it('throws when the calculated total is negative', () => {
    expect(() =>
      calculateHours(
        record({
          entrada: { hora: 18, minuto: 0 },
          saida: { hora: 8, minuto: 0 },
        }),
      ),
    ).toThrow('valor negativo')
  })
})
