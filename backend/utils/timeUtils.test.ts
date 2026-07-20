import { describe, expect, it } from 'vitest'
import { formatMinutes, toMinutes } from './timeUtils'

describe('time helpers', () => {
  it('converts time entries to minutes', () => {
    expect(toMinutes({ hora: 7, minuto: 30 })).toBe(450)
  })

  it('formats positive and negative minute totals', () => {
    expect(formatMinutes(485)).toBe('08:05')
    expect(formatMinutes(-75)).toBe('-01:15')
  })
})
