import type { ManualPontoRecordInput, TimeEntry } from '../types/electron'

const DIAS_SEMANA = [
  'DOMINGO',
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
] as const

export interface PontoEditorRow {
  dia: number
  diaSemana: string
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
  folga: boolean
}

export interface DefaultSchedule {
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
}

export function createMonthlyRows(mes: number, ano: number): PontoEditorRow[] {
  const totalDays = new Date(ano, mes, 0).getDate()

  return Array.from({ length: totalDays }, (_, index) => {
    const dia = index + 1
    const weekDay = new Date(ano, mes - 1, dia).getDay()

    return {
      dia,
      diaSemana: DIAS_SEMANA[weekDay],
      entrada: '',
      inicioIntervalo: '',
      fimIntervalo: '',
      saida: '',
      folga: false,
    }
  })
}

export function parseTimeInput(value: string): TimeEntry | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null

  return { hora: Number(match[1]), minuto: Number(match[2]) }
}

export function toggleFolga(
  rows: PontoEditorRow[],
  dia: number,
  folga: boolean,
): PontoEditorRow[] {
  return rows.map((row) =>
    row.dia === dia
      ? {
          ...row,
          folga,
          entrada: folga ? '' : row.entrada,
          inicioIntervalo: folga ? '' : row.inicioIntervalo,
          fimIntervalo: folga ? '' : row.fimIntervalo,
          saida: folga ? '' : row.saida,
        }
      : row,
  )
}

export function updateRowTime(
  rows: PontoEditorRow[],
  dia: number,
  field: keyof DefaultSchedule,
  value: string,
): PontoEditorRow[] {
  return rows.map((row) =>
    row.dia === dia ? { ...row, [field]: value, folga: false } : row,
  )
}

export function applyDefaultSchedule(
  rows: PontoEditorRow[],
  schedule: DefaultSchedule,
): PontoEditorRow[] {
  return rows.map((row) => (row.folga ? row : { ...row, ...schedule }))
}

export function serializeRowsForManualInput(
  rows: PontoEditorRow[],
): ManualPontoRecordInput[] {
  return rows.map((row) => ({
    dia: row.dia,
    entrada: row.folga ? null : parseTimeInput(row.entrada),
    inicioIntervalo: row.folga ? null : parseTimeInput(row.inicioIntervalo),
    fimIntervalo: row.folga ? null : parseTimeInput(row.fimIntervalo),
    saida: row.folga ? null : parseTimeInput(row.saida),
    folga: row.folga,
  }))
}
