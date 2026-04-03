import type { PontoRecord } from '../types/ponto'
import { toMinutes } from '../utils/timeUtils'

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

  const entradaMin = toMinutes(record.entrada)
  const iiMin = toMinutes(record.inicioIntervalo)
  const fiMin = toMinutes(record.fimIntervalo)
  const saidaMin = toMinutes(record.saida)

  const trabalhado = (saidaMin - entradaMin) - (fiMin - iiMin)

  if (trabalhado < 0) {
    throw new Error(
      `Dia ${record.dia}: cálculo de horas resultou em valor negativo (${trabalhado} min). ` +
        'Verifique se os horários estão em ordem lógica.'
    )
  }

  return trabalhado
}
