import { describe, expect, it } from 'vitest'
import {
  applyDefaultSchedule,
  createMonthlyRows,
  parseTimeInput,
  serializeRowsForManualInput,
  toggleFeriado,
  toggleFolga,
  updateRowTime,
} from './pontoEditor'

describe('pontoEditor helpers', () => {
  it('creates one row per day of the month', () => {
    const rows = createMonthlyRows(2, 2026)

    expect(rows).toHaveLength(28)
    expect(rows[0]).toMatchObject({
      dia: 1,
      diaSemana: 'DOMINGO',
      tipoDia: 'NORMAL',
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
    expect(result[1].tipoDia).toBe('FOLGA')
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
      tipoDia: 'NORMAL',
    })
  })

  it('marks a day as feriado and clears its times', () => {
    const rows = toggleFeriado(createMonthlyRows(2, 2026), 5, true)
    expect(rows[4]).toMatchObject({ dia: 5, tipoDia: 'FERIADO', entrada: '' })
  })

  it('toggling feriado overrides a previous folga on the same day, and vice versa', () => {
    const folgaRows = toggleFolga(createMonthlyRows(2, 2026), 5, true)
    const feriadoRows = toggleFeriado(folgaRows, 5, true)
    expect(feriadoRows[4].tipoDia).toBe('FERIADO')

    const backToFolga = toggleFolga(feriadoRows, 5, true)
    expect(backToFolga[4].tipoDia).toBe('FOLGA')
  })

  it('updateRowTime resets the day back to normal', () => {
    const rows = toggleFeriado(createMonthlyRows(2, 2026), 5, true)
    const updated = updateRowTime(rows, 5, 'entrada', '08:00')
    expect(updated[4].tipoDia).toBe('NORMAL')
  })
})
