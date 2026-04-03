import type { PontoRecord, WeekGroup } from '../types/ponto'
import { getDayOfWeek, getDaysInMonth } from '../utils/dateUtils'
import { formatMinutes } from '../utils/timeUtils'

/**
 * Agrupa os records em semanas de domingo a sábado.
 *
 * Pré-condição: todos os records já devem ter `minutesTrabalhados` calculado
 * por `calculateHours()` antes desta chamada. Valores ausentes (`undefined`)
 * são tratados como 0 para não quebrar o agrupamento, mas o total semanal
 * estará incorreto se a pré-condição não for satisfeita.
 *
 * Regras de fechamento:
 *   - Semana fecha no sábado (getDayOfWeek === 6)
 *   - Se o mês termina antes do sábado seguinte, fecha no último dia do mês
 *   - Primeira semana pode ser parcial (ex: mês começa quarta → fecha no sábado)
 *   - Última semana pode ser parcial (ex: mês termina terça → fecha na terça)
 *
 * Algoritmo:
 *   Para cada dia 1..N:
 *     Adiciona record ao grupo atual
 *     Se é sábado OU é o último dia → fecha o grupo, inicia novo (se houver próximo dia)
 */
export function groupByWeek(
  records: PontoRecord[],
  mes: number,
  ano: number
): WeekGroup[] {
  const totalDays = getDaysInMonth(mes, ano)
  const weeks: WeekGroup[] = []

  // Ordena por dia antes de indexar para garantir ordem cronológica
  // independente da ordem de inserção no Map (chaves numéricas).
  const sorted = [...records].sort((a, b) => a.dia - b.dia)

  // Indexa por dia para acesso O(1) durante o loop de dias do mês.
  const byDay = new Map<number, PontoRecord>()
  for (const r of sorted) {
    byDay.set(r.dia, r)
  }

  let currentGroup: MutableWeekGroup | null = null

  for (let dia = 1; dia <= totalDays; dia++) {
    const record = byDay.get(dia)

    // Dias sem registro são dias completamente vazios que passaram pelo
    // parseRow como 'skip' (nem horários nem FOLGA preenchidos).
    // Não lançamos erro aqui porque o validador não impede isso ainda;
    // esses dias simplesmente não aparecem em nenhuma semana.
    if (!record) continue

    if (!currentGroup) {
      currentGroup = { inicio: dia, records: [] }
    }

    currentGroup.records.push(record)

    const diaSemana = getDayOfWeek(dia, mes, ano)
    const isSaturday = diaSemana === 6
    const isLastDay = dia === totalDays

    if (isSaturday || isLastDay) {
      weeks.push(closeGroup(currentGroup, dia))
      currentGroup = null
    }
  }

  return weeks
}

// ── Helpers internos ──────────────────────────────────────────────────────────

interface MutableWeekGroup {
  inicio: number
  records: PontoRecord[]
}

function closeGroup(group: MutableWeekGroup, fimDia: number): WeekGroup {
  const totalMinutos = group.records.reduce(
    (acc, r) => acc + (r.minutesTrabalhados ?? 0),
    0
  )

  return {
    inicio: group.inicio,
    fim: fimDia,
    records: group.records,
    totalMinutos,
    totalFormatado: formatMinutes(totalMinutos),
  }
}
