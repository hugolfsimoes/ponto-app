import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'

dayjs.locale('pt-br')

export const DIAS_SEMANA = [
  'DOMINGO',
  'SEGUNDA',
  'TERÇA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SÁBADO'
] as const

export type DiaSemana = (typeof DIAS_SEMANA)[number]

/** Retorna a quantidade de dias do mês. */
export function getDaysInMonth(mes: number, ano: number): number {
  return dayjs(`${ano}-${String(mes).padStart(2, '0')}-01`).daysInMonth()
}

/**
 * Retorna o nome do dia da semana em português maiúsculo.
 * dia: 1-31, mes: 1-12, ano: ex. 2026
 */
export function getDayName(dia: number, mes: number, ano: number): DiaSemana {
  const d = dayjs(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
  const index = d.day()
  return DIAS_SEMANA[index] ?? 'DOMINGO'
}

/**
 * Retorna o índice do dia da semana (0=domingo, 6=sábado).
 * dia: 1-31, mes: 1-12, ano: ex. 2026
 */
export function getDayOfWeek(dia: number, mes: number, ano: number): number {
  return dayjs(
    `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  ).day()
}
