import { calculateHours } from './calculateHours'
import { groupByWeek } from './groupByWeek'
import type {
  ManualPontoRecordInput,
  PontoData,
  PontoHeader,
  PontoRecord,
  ProcessResult,
  TimeEntry,
  ValidationError,
} from '../types/ponto'
import { getDayName, getDaysInMonth } from '../utils/dateUtils'
import { formatMinutes, MINUTES_IN_DAY, normalizeSequentialMinutes } from '../utils/timeUtils'

const FIELD_LABELS: Array<[keyof ManualPontoRecordInput, string]> = [
  ['entrada', 'Entrada'],
  ['inicioIntervalo', 'Inicio Intervalo'],
  ['fimIntervalo', 'Fim Intervalo'],
  ['saida', 'Saida'],
]

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function buildPontoDataFromManualInput(
  header: PontoHeader,
  rows: ManualPontoRecordInput[],
): ProcessResult {
  const errors = validateManualRows(header, rows)
  if (errors.length > 0) return { success: false, errors }

  const records: PontoRecord[] = rows
    .slice()
    .sort((a, b) => a.dia - b.dia)
    .map((row) => {
      const record: PontoRecord = {
        dia: row.dia,
        diaSemana: getDayName(row.dia, header.mes, header.ano),
        entrada: row.tipoDia === 'NORMAL' ? row.entrada : null,
        inicioIntervalo: row.tipoDia === 'NORMAL' ? row.inicioIntervalo : null,
        fimIntervalo: row.tipoDia === 'NORMAL' ? row.fimIntervalo : null,
        saida: row.tipoDia === 'NORMAL' ? row.saida : null,
        tipoDia: row.tipoDia,
      }

      return { ...record, minutesTrabalhados: calculateHours(record) }
    })

  const weeks = groupByWeek(records, header.mes, header.ano)
  const totalMensalMinutos = records.reduce(
    (total, record) => total + (record.minutesTrabalhados ?? 0),
    0,
  )

  const data: PontoData = {
    header,
    records,
    weeks,
    totalMensalMinutos,
    totalMensalFormatado: formatMinutes(totalMensalMinutos),
  }

  return { success: true, data }
}

function validateManualRows(
  header: PontoHeader,
  rows: ManualPontoRecordInput[],
): ValidationError[] {
  const errors: ValidationError[] = []
  const totalDays = getDaysInMonth(header.mes, header.ano)
  const seen = new Set<number>()

  for (const row of rows) {
    if (row.dia < 1 || row.dia > totalDays) {
      errors.push({
        dia: row.dia,
        campo: 'Dia',
        mensagem: `Dia ${row.dia} nao existe em ${MESES[header.mes - 1]}/${header.ano}.`,
      })
      continue
    }

    if (seen.has(row.dia)) {
      errors.push({
        dia: row.dia,
        campo: 'Dia',
        mensagem: `Dia ${row.dia}: registro duplicado.`,
      })
      continue
    }
    seen.add(row.dia)

    if (row.tipoDia !== 'NORMAL') continue

    for (const [field, label] of FIELD_LABELS) {
      if (!row[field]) {
        errors.push({
          dia: row.dia,
          campo: label,
          mensagem: `Dia ${row.dia}: ${label} e obrigatorio em dia trabalhado.`,
        })
      }
    }

    if (hasAllTimes(row) && !isChronological(row)) {
      errors.push({
        dia: row.dia,
        campo: 'Horarios',
        mensagem: `Dia ${row.dia}: horarios devem seguir a ordem Entrada, Inicio Intervalo, Fim Intervalo e Saida.`,
      })
    }
  }

  for (let dia = 1; dia <= totalDays; dia++) {
    if (!seen.has(dia)) {
      errors.push({
        dia,
        campo: 'Dia',
        mensagem: `Dia ${dia}: registro obrigatorio na grade mensal.`,
      })
    }
  }

  return errors
}

function hasAllTimes(row: ManualPontoRecordInput): row is ManualPontoRecordInput & {
  entrada: TimeEntry
  inicioIntervalo: TimeEntry
  fimIntervalo: TimeEntry
  saida: TimeEntry
} {
  return !!row.entrada && !!row.inicioIntervalo && !!row.fimIntervalo && !!row.saida
}

function isChronological(row: {
  entrada: TimeEntry
  inicioIntervalo: TimeEntry
  fimIntervalo: TimeEntry
  saida: TimeEntry
}): boolean {
  const normalized = normalizeSequentialMinutes([
    row.entrada,
    row.inicioIntervalo,
    row.fimIntervalo,
    row.saida,
  ])

  const totalPeriodo = normalized[normalized.length - 1] - normalized[0]
  return (
    totalPeriodo <= MINUTES_IN_DAY &&
    normalized.every((minutes, index) => index === 0 || minutes > normalized[index - 1])
  )
}
