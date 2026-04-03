import type { TimeEntry, ValidationError } from '../types/ponto'

/**
 * Converte um valor de célula do Excel para TimeEntry.
 *
 * Trata os 4 formatos possíveis que a lib xlsx pode retornar:
 *   1. string "HH:mm"
 *   2. número serial do Excel (fração de dia, ex: 0.75 = 18:00)
 *   3. objeto Date do JS (xlsx pode converter automaticamente)
 *   4. null / undefined / célula vazia → retorna null
 *
 * Lança ValidationError para valores presentes mas não reconhecidos.
 */
export function parseExcelTime(
  value: unknown,
  dia: number,
  campo: string
): TimeEntry | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null

    const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
    if (match) {
      return { hora: parseInt(match[1], 10), minuto: parseInt(match[2], 10) }
    }

    throw createValidationError(dia, campo, `Formato inválido: "${trimmed}". Use HH:mm`, trimmed)
  }

  if (typeof value === 'number') {
    if (value < 0 || value > 1) {
      throw createValidationError(dia, campo, `Serial numérico fora do intervalo esperado: ${value}`, value)
    }
    const totalMinutes = Math.round(value * 24 * 60)
    const hora = Math.floor(totalMinutes / 60) % 24
    const minuto = totalMinutes % 60
    return { hora, minuto }
  }

  if (value instanceof Date) {
    // UTC evita distorção pelo fuso horário do sistema operacional:
    // xlsx armazena o serial como fração de dia UTC, e ao converter para
    // Date pode aplicar o offset local, corrompendo hora e minuto.
    return {
      hora: value.getUTCHours(),
      minuto: value.getUTCMinutes()
    }
  }

  throw createValidationError(
    dia,
    campo,
    `Tipo de valor não reconhecido: ${typeof value}`,
    value
  )
}

function createValidationError(
  dia: number,
  campo: string,
  mensagem: string,
  rawValue?: unknown
): ValidationError & Error {
  const rawInfo = rawValue !== undefined ? ` (raw: ${JSON.stringify(rawValue)})` : ''
  const err = new Error(
    `Dia ${dia}: campo '${campo}' — ${mensagem}${rawInfo}`
  ) as ValidationError & Error
  err.dia = dia
  err.campo = campo
  err.mensagem = `Dia ${dia}: campo '${campo}' — ${mensagem}${rawInfo}`
  return err
}

/** Converte TimeEntry em minutos desde meia-noite. */
export function toMinutes(entry: TimeEntry): number {
  return entry.hora * 60 + entry.minuto
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
