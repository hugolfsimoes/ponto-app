import { describe, expect, it } from 'vitest'
import { formatMinutes, parseExcelTime, toMinutes } from './timeUtils'

describe('parseExcelTime', () => {
  it('parses HH:mm strings', () => {
    expect(parseExcelTime('08:35', 1, 'entrada')).toEqual({
      hora: 8,
      minuto: 35,
    })
  })

  it('parses Excel numeric serials as fractions of a day', () => {
    expect(parseExcelTime(0.75, 1, 'saida')).toEqual({
      hora: 18,
      minuto: 0,
    })
  })

  it('rounds numeric serials to the nearest minute', () => {
    expect(parseExcelTime(0.333333333, 1, 'entrada')).toEqual({
      hora: 8,
      minuto: 0,
    })
  })

  it('parses Date values using UTC hours and minutes', () => {
    expect(
      parseExcelTime(new Date(Date.UTC(2026, 0, 1, 14, 45)), 1, 'saida'),
    ).toEqual({ hora: 14, minuto: 45 })
  })

  it('returns null for empty values', () => {
    expect(parseExcelTime(null, 1, 'entrada')).toBeNull()
    expect(parseExcelTime(undefined, 1, 'entrada')).toBeNull()
    expect(parseExcelTime('', 1, 'entrada')).toBeNull()
    expect(parseExcelTime('   ', 1, 'entrada')).toBeNull()
  })

  it('throws a validation error with day and field context for invalid strings', () => {
    expect(() => parseExcelTime('25:00', 7, 'saida')).toThrow(
      "Dia 7: campo 'saida'",
    )
  })

  it('throws a validation error for serials outside the expected interval', () => {
    expect(() => parseExcelTime(1.25, 3, 'entrada')).toThrow(
      'Serial numérico fora do intervalo esperado',
    )
  })
})

describe('time helpers', () => {
  it('converts time entries to minutes', () => {
    expect(toMinutes({ hora: 7, minuto: 30 })).toBe(450)
  })

  it('formats positive and negative minute totals', () => {
    expect(formatMinutes(485)).toBe('08:05')
    expect(formatMinutes(-75)).toBe('-01:15')
  })
})
