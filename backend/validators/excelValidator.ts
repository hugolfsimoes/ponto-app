import type { PontoRecord, ValidationError } from '../types/ponto'
import { toMinutes } from '../utils/timeUtils'

const CAMPOS = {
  entrada: 'Entrada',
  inicioIntervalo: 'Início Intervalo',
  fimIntervalo: 'Fim Intervalo',
  saida: 'Saída',
} as const

type CampoKey = keyof typeof CAMPOS

/**
 * Valida os registros de ponto já parseados.
 * Acumula todos os erros encontrados sem interromper na primeira falha.
 */
export function validate(records: PontoRecord[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (const record of records) {
    if (record.folga) continue

    const { dia, entrada, inicioIntervalo, fimIntervalo, saida } = record
    const campos: Record<CampoKey, typeof entrada> = { entrada, inicioIntervalo, fimIntervalo, saida }

    const algumPreenchido = Object.values(campos).some((v) => v !== null)
    if (!algumPreenchido) continue

    const faltantes = (Object.entries(campos) as [CampoKey, typeof entrada][]).filter(
      ([, v]) => v === null
    )

    if (faltantes.length > 0) {
      for (const [key] of faltantes) {
        errors.push({
          dia,
          campo: CAMPOS[key],
          mensagem: `Dia ${dia}: campo '${CAMPOS[key]}' é obrigatório quando outros horários estão preenchidos`,
        })
      }
      continue
    }

    validateOrder(dia, entrada!, inicioIntervalo!, fimIntervalo!, saida!, errors)
  }

  return errors
}

function validateOrder(
  dia: number,
  entrada: NonNullable<PontoRecord['entrada']>,
  inicioIntervalo: NonNullable<PontoRecord['inicioIntervalo']>,
  fimIntervalo: NonNullable<PontoRecord['fimIntervalo']>,
  saida: NonNullable<PontoRecord['saida']>,
  errors: ValidationError[]
): void {
  const e = toMinutes(entrada)
  const ii = toMinutes(inicioIntervalo)
  const fi = toMinutes(fimIntervalo)
  const s = toMinutes(saida)

  const pares: Array<{ aNome: string; aMin: number; bNome: string; bMin: number }> = [
    { aNome: CAMPOS.entrada, aMin: e, bNome: CAMPOS.inicioIntervalo, bMin: ii },
    { aNome: CAMPOS.inicioIntervalo, aMin: ii, bNome: CAMPOS.fimIntervalo, bMin: fi },
    { aNome: CAMPOS.fimIntervalo, aMin: fi, bNome: CAMPOS.saida, bMin: s },
  ]

  for (const { aNome, aMin, bNome, bMin } of pares) {
    if (aMin === bMin) {
      errors.push({
        dia,
        campo: aNome,
        mensagem: `Dia ${dia}: '${aNome}' (${fmt(aMin)}) e '${bNome}' (${fmt(bMin)}) não podem ser iguais`,
      })
    } else if (aMin > bMin) {
      errors.push({
        dia,
        campo: aNome,
        mensagem: `Dia ${dia}: '${aNome}' (${fmt(aMin)}) deve ser anterior a '${bNome}' (${fmt(bMin)})`,
      })
    }
  }
}

function fmt(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
