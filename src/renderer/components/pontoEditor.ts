import type { ManualPontoRecordInput, TimeEntry, TipoDia } from '../types/electron'

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
  tipoDia: TipoDia
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
      tipoDia: 'NORMAL',
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
  checked: boolean,
): PontoEditorRow[] {
  return setTipoDia(rows, dia, checked ? 'FOLGA' : 'NORMAL')
}

export function toggleFeriado(
  rows: PontoEditorRow[],
  dia: number,
  checked: boolean,
): PontoEditorRow[] {
  return setTipoDia(rows, dia, checked ? 'FERIADO' : 'NORMAL')
}

function setTipoDia(
  rows: PontoEditorRow[],
  dia: number,
  tipoDia: TipoDia,
): PontoEditorRow[] {
  return rows.map((row) =>
    row.dia === dia
      ? {
          ...row,
          tipoDia,
          entrada: tipoDia === 'NORMAL' ? row.entrada : '',
          inicioIntervalo: tipoDia === 'NORMAL' ? row.inicioIntervalo : '',
          fimIntervalo: tipoDia === 'NORMAL' ? row.fimIntervalo : '',
          saida: tipoDia === 'NORMAL' ? row.saida : '',
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
    row.dia === dia ? { ...row, [field]: value, tipoDia: 'NORMAL' } : row,
  )
}

export function applyDefaultSchedule(
  rows: PontoEditorRow[],
  schedule: DefaultSchedule,
): PontoEditorRow[] {
  return rows.map((row) => (row.tipoDia === 'NORMAL' ? { ...row, ...schedule } : row))
}

export function serializeRowsForManualInput(
  rows: PontoEditorRow[],
): ManualPontoRecordInput[] {
  return rows.map((row) => ({
    dia: row.dia,
    entrada: row.tipoDia === 'NORMAL' ? parseTimeInput(row.entrada) : null,
    inicioIntervalo: row.tipoDia === 'NORMAL' ? parseTimeInput(row.inicioIntervalo) : null,
    fimIntervalo: row.tipoDia === 'NORMAL' ? parseTimeInput(row.fimIntervalo) : null,
    saida: row.tipoDia === 'NORMAL' ? parseTimeInput(row.saida) : null,
    tipoDia: row.tipoDia,
  }))
}
