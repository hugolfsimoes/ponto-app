import type { TimeEntry } from '../types/ponto'

export const MINUTES_IN_DAY = 24 * 60

/** Converte TimeEntry em minutos desde meia-noite. */
export function toMinutes(entry: TimeEntry): number {
  return entry.hora * 60 + entry.minuto
}

/**
 * Converte horarios de uma jornada em uma linha do tempo continua.
 *
 * Quando um horario fica menor que o anterior, ele e interpretado como
 * pertencente ao dia seguinte. Ex.: 22:00, 01:00, 02:00 => 1320, 1500, 1560.
 */
export function normalizeSequentialMinutes(entries: TimeEntry[]): number[] {
  const minutes: number[] = []
  let dayOffset = 0

  for (const entry of entries) {
    let current = toMinutes(entry) + dayOffset
    const previous = minutes[minutes.length - 1]

    if (previous !== undefined && current < previous) {
      dayOffset += MINUTES_IN_DAY
      current += MINUTES_IN_DAY
    }

    minutes.push(current)
  }

  return minutes
}

/** Converte total de minutos para string "HH:mm". */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 0) {
    const abs = Math.abs(totalMinutes)
    const hh = Math.floor(abs / 60)
    const mm = abs % 60
    return `-${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
