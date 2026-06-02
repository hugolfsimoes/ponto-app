import { describe, expect, it } from 'vitest'
import {
  applyDefaultSchedule,
  createMonthlyRows,
  parseTimeInput,
  serializeRowsForManualInput,
  toggleFolga,
} from './pontoEditor'

describe('pontoEditor helpers', () => {
  it('creates one row per day of the month', () => {
    const rows = createMonthlyRows(2, 2026)

    expect(rows).toHaveLength(28)
    expect(rows[0]).toMatchObject({
      dia: 1,
      diaSemana: 'DOMINGO',
      folga: false,
    })
    expect(rows[27]).toMatchObject({ dia: 28 })
  })

  it('parses HH:mm input', () => {
    expect(parseTimeInput('08:30')).toEqual({ hora: 8, minuto: 30 })
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput('8:30')).toBeNull()
    expect(parseTimeInput('25:00')).toBeNull()
  })

  it('applies a default schedule only to non-folga rows', () => {
    const rows = toggleFolga(createMonthlyRows(2, 2026), 2, true)
    const result = applyDefaultSchedule(rows, {
      entrada: '08:00',
      inicioIntervalo: '12:00',
      fimIntervalo: '13:00',
      saida: '17:00',
    })

    expect(result[0].entrada).toBe('08:00')
    expect(result[1].entrada).toBe('')
    expect(result[1].folga).toBe(true)
  })

  it('serializes UI rows to manual backend input', () => {
    const rows = applyDefaultSchedule(createMonthlyRows(2, 2026), {
      entrada: '08:00',
      inicioIntervalo: '12:00',
      fimIntervalo: '13:00',
      saida: '17:00',
    })

    expect(serializeRowsForManualInput(rows)[0]).toEqual({
      dia: 1,
      entrada: { hora: 8, minuto: 0 },
      inicioIntervalo: { hora: 12, minuto: 0 },
      fimIntervalo: { hora: 13, minuto: 0 },
      saida: { hora: 17, minuto: 0 },
      folga: false,
    })
  })
})
