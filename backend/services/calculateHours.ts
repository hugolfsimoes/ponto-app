import type { PontoRecord } from '../types/ponto'
import { MINUTES_IN_DAY, normalizeSequentialMinutes } from '../utils/timeUtils'

/**
 * Calcula os minutos trabalhados para um PontoRecord já validado.
 *
 * Fórmula: (saída − entrada) − (fimIntervalo − inicioIntervalo)
 *
 * Pré-condição: o record foi validado por excelValidator.validate() antes
 * desta chamada — os horários estão em ordem lógica e nenhum campo obrigatório
 * está ausente quando folga === false.
 */
export function calculateHours(record: PontoRecord): number {
  if (record.folga) return 0

  // Guard: se por algum motivo campos chegarem nulos em modo não-folga,
  // retorna 0 em vez de lançar exceção (validação prévia deve prevenir isso).
  if (
    !record.entrada ||
    !record.inicioIntervalo ||
    !record.fimIntervalo ||
    !record.saida
  ) {
    return 0
  }

  const [entradaMin, iiMin, fiMin, saidaMin] = normalizeSequentialMinutes([
    record.entrada,
    record.inicioIntervalo,
    record.fimIntervalo,
    record.saida,
  ])

  const totalPeriodo = saidaMin - entradaMin
  if (totalPeriodo > MINUTES_IN_DAY) {
    throw new Error(
      `Dia ${record.dia}: jornada normalizada excede 24 horas (${totalPeriodo} min). ` +
        'Verifique se os horários estão em ordem lógica.'
    )
  }

  const trabalhado = (saidaMin - entradaMin) - (fiMin - iiMin)

  if (trabalhado < 0) {
    throw new Error(
      `Dia ${record.dia}: cálculo de horas resultou em valor negativo (${trabalhado} min). ` +
        'Verifique se os horários estão em ordem lógica.'
    )
  }

  return trabalhado
}
