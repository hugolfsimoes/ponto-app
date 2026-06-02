import { describe, expect, it } from 'vitest'
import type {
  ManualPontoRecordInput,
  PontoHeader,
  TimeEntry,
} from '../types/ponto'
import { buildPontoDataFromManualInput } from './buildPontoDataFromManualInput'

const header: PontoHeader = {
  empresa: 'Empresa Azul',
  nome: 'Ana Silva',
  secao: 'Portaria',
  mes: 2,
  ano: 2026,
}

const time = (hora: number, minuto = 0): TimeEntry => ({ hora, minuto })

function workingDay(dia: number): ManualPontoRecordInput {
  return {
    dia,
    entrada: time(8),
    inicioIntervalo: time(12),
    fimIntervalo: time(13),
    saida: time(17),
    folga: false,
  }
}

function fullMonth(
  overrides: Partial<ManualPontoRecordInput>[] = [],
): ManualPontoRecordInput[] {
  const rows = Array.from({ length: 28 }, (_, index) => workingDay(index + 1))
  for (const override of overrides) {
    const index = (override.dia ?? 1) - 1
    rows[index] = { ...rows[index], ...override }
  }
  return rows
}

describe('buildPontoDataFromManualInput', () => {
  it('builds PontoData with daily, weekly and monthly totals', () => {
    const result = buildPontoDataFromManualInput(header, fullMonth())

    expect(result.success).toBe(true)
    expect(result.data?.records).toHaveLength(28)
    expect(result.data?.records[0].minutesTrabalhados).toBe(480)
    expect(result.data?.totalMensalMinutos).toBe(28 * 480)
    expect(result.data?.totalMensalFormatado).toBe('224:00')
    expect(result.data?.weeks.length).toBeGreaterThan(0)
  })

  it('includes overnight shifts in daily, weekly and monthly totals', () => {
    const result = buildPontoDataFromManualInput(
      header,
      fullMonth([
        {
          dia: 2,
          entrada: time(18),
          inicioIntervalo: time(21),
          fimIntervalo: time(22),
          saida: time(4),
        },
        {
          dia: 3,
          entrada: time(22),
          inicioIntervalo: time(1),
          fimIntervalo: time(2),
          saida: time(6),
        },
      ]),
    )

    expect(result.success).toBe(true)
    expect(result.data?.records[1].minutesTrabalhados).toBe(540)
    expect(result.data?.records[2].minutesTrabalhados).toBe(420)
    expect(result.data?.weeks[0].totalMinutos).toBe(480 + 540 + 420 + 4 * 480)
    expect(result.data?.weeks[0].totalFormatado).toBe('56:00')
    expect(result.data?.totalMensalMinutos).toBe(26 * 480 + 540 + 420)
    expect(result.data?.totalMensalFormatado).toBe('224:00')
  })

  it('marks folga days with zero minutes', () => {
    const result = buildPontoDataFromManualInput(
      header,
      fullMonth([
        {
          dia: 3,
          entrada: null,
          inicioIntervalo: null,
          fimIntervalo: null,
          saida: null,
          folga: true,
        },
      ]),
    )

    expect(result.success).toBe(true)
    expect(result.data?.records[2]).toMatchObject({
      dia: 3,
      folga: true,
      minutesTrabalhados: 0,
    })
  })

  it('rejects incomplete normal days', () => {
    const result = buildPontoDataFromManualInput(
      header,
      fullMonth([{ dia: 7, fimIntervalo: null }]),
    )

    expect(result.success).toBe(false)
    expect(result.errors).toContainEqual({
      dia: 7,
      campo: 'Fim Intervalo',
      mensagem: 'Dia 7: Fim Intervalo e obrigatorio em dia trabalhado.',
    })
  })

  it('rejects invalid chronological order', () => {
    const result = buildPontoDataFromManualInput(
      header,
      fullMonth([{ dia: 9, entrada: time(14), inicioIntervalo: time(12) }]),
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0].mensagem).toBe(
      'Dia 9: horarios devem seguir a ordem Entrada, Inicio Intervalo, Fim Intervalo e Saida.',
    )
  })

  it('rejects days outside the selected month', () => {
    const result = buildPontoDataFromManualInput(header, [
      ...fullMonth(),
      workingDay(29),
    ])

    expect(result.success).toBe(false)
    expect(result.errors).toContainEqual({
      dia: 29,
      campo: 'Dia',
      mensagem: 'Dia 29 nao existe em Fevereiro/2026.',
    })
  })
})
