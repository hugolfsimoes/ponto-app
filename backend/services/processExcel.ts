import { readFile } from 'fs/promises'
import * as XLSX from 'xlsx'
import type {
  PontoHeader,
  PontoRecord,
  PontoData,
  ProcessResult,
  ValidationError,
} from '../types/ponto'
import { DIAS_SEMANA } from '../utils/dateUtils'
import type { DiaSemana } from '../utils/dateUtils'
import { parseExcelTime, formatMinutes } from '../utils/timeUtils'
import { validate } from '../validators/excelValidator'
import { calculateHours } from './calculateHours'
import { groupByWeek } from './groupByWeek'

/** Linhas fixas antes da tabela (título/empresa/func./seção/mês + linha DIA…). Template novo = 6. */
const HEADER_ROWS = 6

const MESES_NOME: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3, // após NFD sem marcas / editores que normalizam diferente
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

const FOLGA_RE = /^folga$/i

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ParseRowOk {
  type: 'ok'
  record: PontoRecord
  warnings: ValidationError[]
}

interface ParseRowSkip {
  type: 'skip'
}

interface ParseRowError {
  type: 'error'
  errors: ValidationError[]
}

type ParseRowResult = ParseRowOk | ParseRowSkip | ParseRowError

// ── Funções auxiliares de extração do cabeçalho ───────────────────────────────

function getCellString(ws: XLSX.WorkSheet, addr: string): string {
  const cell = ws[addr]
  if (!cell) return ''
  return String(cell.v ?? '').trim()
}

/** Limites da planilha (fallback amplo se `!ref` vier vazio). */
function getSheetRange(ws: XLSX.WorkSheet): XLSX.Range {
  if (ws['!ref']) return XLSX.utils.decode_range(ws['!ref'])
  return { s: { r: 0, c: 0 }, e: { r: 200, c: 25 } }
}

/** Procura, numa linha (0-based), a primeira célula cujo texto casa com `re` (grupo 1 = valor). */
function scanRowForRegex(
  ws: XLSX.WorkSheet,
  row0: number,
  re: RegExp
): string | undefined {
  const range = getSheetRange(ws)
  if (row0 < range.s.r || row0 > range.e.r) return undefined
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: row0, c })
    const raw = getCellString(ws, addr)
    const m = raw.match(re)
    if (m?.[1] != null) return m[1].trim()
  }
  return undefined
}

/** Índices 0-based das linhas típicas do cabeçalho + margem. */
const HEADER_SCAN_ROWS_0 = [2, 3, 1, 4, 5, 0]
const SECAO_SCAN_ROWS_0 = [3, 2, 4, 5, 1, 0] // prioriza linha 4 (SEÇÃO no template novo)

function extractNome(ws: XLSX.WorkSheet): string {
  const re = /FUNCION[ÁA]RIO:\s*(.+)/i
  const direct = getCellString(ws, 'A3').match(re)
  if (direct) return direct[1].trim()
  for (const r of HEADER_SCAN_ROWS_0) {
    const v = scanRowForRegex(ws, r, re)
    if (v) return v
  }
  return ''
}

function extractSecao(ws: XLSX.WorkSheet): string {
  const re = /SE[ÇC][ÃA]O:\s*(.+)/i
  const a4 = getCellString(ws, 'A4').match(re)
  if (a4) return a4[1].trim()
  const d3 = getCellString(ws, 'D3').match(re)
  if (d3) return d3[1].trim() // planilhas antigas (SEÇÃO à direita na linha 3)
  for (const r of SECAO_SCAN_ROWS_0) {
    const v = scanRowForRegex(ws, r, re)
    if (v) return v
  }
  return ''
}

function extractMesAno(ws: XLSX.WorkSheet): { mes: number; ano: number } | null {
  // Planilhas novas: mês na linha 5 (A5). Antigas: linha 4 (A4). Texto: "Março / 2026" ou com prefixo MÊS/ANO:
  const re = /(?:M[EÊ]S\/ANO:\s*)?(.+?)\s*\/\s*(\d{4})/i
  for (const addr of ['A5', 'A4'] as const) {
    const direct = getCellString(ws, addr).match(re)
    if (direct) {
      const mes = resolveMesDoTexto(direct[1])
      const ano = parseInt(direct[2], 10)
      if (mes && !isNaN(ano)) return { mes, ano }
    }
  }

  const range = getSheetRange(ws)
  const rEnd = Math.min(range.e.r, 15)
  for (let r = range.s.r; r <= rEnd; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const raw = getCellString(ws, addr)
      const match = raw.match(re)
      if (!match) continue
      const mes = resolveMesDoTexto(match[1])
      const ano = parseInt(match[2], 10)
      if (mes && !isNaN(ano)) return { mes, ano }
    }
  }
  return null
}

function resolveMesDoTexto(label: string): number | undefined {
  const mesNome = label.trim().toLowerCase()
  if (MESES_NOME[mesNome]) return MESES_NOME[mesNome]
  const semMarcas = mesNome.normalize('NFD').replace(/\p{M}/gu, '')
  return MESES_NOME[semMarcas]
}

function extractEmpresa(ws: XLSX.WorkSheet): string {
  const re = /EMPRESA:\s*(.+)/i
  const direct = getCellString(ws, 'A2').match(re)
  if (direct) return direct[1].trim()
  for (const r of [1, 2, 0, 3]) {
    const v = scanRowForRegex(ws, r, re)
    if (v) return v
  }
  return 'PROTMAX SERVIÇOS EM CONDOMÍNIO'
}

interface HeaderResult {
  header?: PontoHeader
  errors: ValidationError[]
}

function extractHeader(ws: XLSX.WorkSheet): HeaderResult {
  const errors: ValidationError[] = []

  const nome = extractNome(ws)
  if (!nome) {
    errors.push({ dia: 0, campo: 'Nome', mensagem: "Célula 'Funcionário' não encontrada no cabeçalho" })
  }

  const secao = extractSecao(ws)
  if (!secao) {
    errors.push({ dia: 0, campo: 'Seção', mensagem: "Célula 'Seção' não encontrada no cabeçalho" })
  }

  const mesAno = extractMesAno(ws)
  if (!mesAno) {
    errors.push({
      dia: 0,
      campo: 'Mês/Ano',
      mensagem: "Célula 'Mês/Ano' não encontrada ou com formato inválido no cabeçalho",
    })
  }

  if (errors.length > 0) return { errors }

  return {
    header: {
      empresa: extractEmpresa(ws),
      nome,
      secao,
      mes: mesAno!.mes,
      ano: mesAno!.ano,
    },
    errors: [],
  }
}

// ── Parsing de uma linha de dados ─────────────────────────────────────────────

function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => cell === null || cell === undefined || cell === '')
}

function toValidationError(caught: unknown, dia: number, campo: string): ValidationError {
  if (
    typeof caught === 'object' &&
    caught !== null &&
    'dia' in caught &&
    'campo' in caught &&
    'mensagem' in caught
  ) {
    return caught as ValidationError
  }
  const msg = caught instanceof Error ? caught.message : String(caught)
  return { dia, campo, mensagem: msg }
}

function parseRow(row: unknown[]): ParseRowResult {
  if (isRowEmpty(row)) return { type: 'skip' }

  const [diaRaw, diaSemanaRaw, entradaRaw, iiRaw, fiRaw, saidaRaw] = row

  if (typeof diaRaw !== 'number' || !Number.isInteger(diaRaw)) return { type: 'skip' }
  const dia = diaRaw
  if (dia < 1 || dia > 31) return { type: 'skip' }

  const diaSemanaStr = String(diaSemanaRaw ?? '').trim().toUpperCase()
  if (!(DIAS_SEMANA as readonly string[]).includes(diaSemanaStr)) {
    return {
      type: 'error',
      errors: [{
        dia,
        campo: 'Dia da Semana',
        mensagem: `Dia ${dia}: valor inválido para dia da semana: '${diaSemanaStr}'`,
      }],
    }
  }
  const diaSemana = diaSemanaStr as DiaSemana

  const warnings: ValidationError[] = []

  const slots: Array<{ raw: unknown; campo: string }> = [
    { raw: entradaRaw, campo: 'Entrada' },
    { raw: iiRaw, campo: 'Início Intervalo' },
    { raw: fiRaw, campo: 'Fim Intervalo' },
    { raw: saidaRaw, campo: 'Saída' },
  ]

  type CelulaHorario = 'vazio' | 'folga' | 'valor'
  const classificar = (raw: unknown): CelulaHorario => {
    if (raw === null || raw === undefined || raw === '') return 'vazio'
    if (typeof raw === 'string') {
      const t = raw.trim()
      if (t === '') return 'vazio'
      if (FOLGA_RE.test(t)) return 'folga'
    }
    return 'valor'
  }

  const classes = slots.map((s) => classificar(s.raw))
  const nFolga = classes.filter((c) => c === 'folga').length
  const nVazio = classes.filter((c) => c === 'vazio').length

  if (nVazio === 4) {
    return {
      type: 'error',
      errors: [{
        dia,
        campo: 'Horários',
        mensagem:
          `Dia ${dia}: preencha as quatro colunas (Entrada, intervalos e Saída) com horários ` +
          `ou escreva FOLGA nas quatro — não deixe células vazias.`,
      }],
    }
  }

  if (nVazio > 0) {
    const errors: ValidationError[] = []
    for (let i = 0; i < slots.length; i++) {
      if (classes[i] !== 'vazio') continue
      errors.push({
        dia,
        campo: slots[i].campo,
        mensagem: `Dia ${dia}: campo '${slots[i].campo}' está vazio; use horário (HH:mm) ou FOLGA.`,
      })
    }
    return { type: 'error', errors }
  }

  if (nFolga > 0 && nFolga < 4) {
    return {
      type: 'error',
      errors: [{
        dia,
        campo: 'FOLGA',
        mensagem:
          `Dia ${dia}: em dia de folga, as quatro colunas de horário devem conter FOLGA. ` +
          `Não misture FOLGA com horários nem deixe só algumas colunas com FOLGA.`,
      }],
    }
  }

  if (nFolga === 4) {
    return {
      type: 'ok',
      record: {
        dia,
        diaSemana,
        entrada: null,
        inicioIntervalo: null,
        fimIntervalo: null,
        saida: null,
        folga: true,
      },
      warnings,
    }
  }

  // Quatro valores (horários); parse individual
  const errors: ValidationError[] = []
  let entrada = null
  let inicioIntervalo = null
  let fimIntervalo = null
  let saida = null

  try {
    entrada = parseExcelTime(entradaRaw, dia, 'Entrada')
  } catch (e) {
    errors.push(toValidationError(e, dia, 'Entrada'))
  }
  try {
    inicioIntervalo = parseExcelTime(iiRaw, dia, 'Início Intervalo')
  } catch (e) {
    errors.push(toValidationError(e, dia, 'Início Intervalo'))
  }
  try {
    fimIntervalo = parseExcelTime(fiRaw, dia, 'Fim Intervalo')
  } catch (e) {
    errors.push(toValidationError(e, dia, 'Fim Intervalo'))
  }
  try {
    saida = parseExcelTime(saidaRaw, dia, 'Saída')
  } catch (e) {
    errors.push(toValidationError(e, dia, 'Saída'))
  }

  if (errors.length > 0) return { type: 'error', errors }

  if (entrada === null || inicioIntervalo === null || fimIntervalo === null || saida === null) {
    return {
      type: 'error',
      errors: [{
        dia,
        campo: 'Horários',
        mensagem: `Dia ${dia}: os quatro campos devem ter horário válido (HH:mm) ou FOLGA em todos.`,
      }],
    }
  }

  return {
    type: 'ok',
    record: { dia, diaSemana, entrada, inicioIntervalo, fimIntervalo, saida, folga: false },
    warnings,
  }
}

// ── Orquestrador principal ────────────────────────────────────────────────────

export async function processExcel(filePath: string): Promise<ProcessResult> {
  // 1. Leitura: Node fs + XLSX.read(buffer) — o ESM do xlsx não expõe readFile no Electron.
  let workbook: XLSX.WorkBook
  try {
    const buf = await readFile(filePath)
    workbook = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      errors: [{ dia: 0, campo: 'arquivo', mensagem: `Erro ao ler o arquivo: ${msg}` }],
    }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return {
      success: false,
      errors: [{ dia: 0, campo: 'arquivo', mensagem: 'Arquivo vazio: nenhuma planilha encontrada' }],
    }
  }

  const ws = workbook.Sheets[sheetName]

  // 2. Extração do cabeçalho
  const headerResult = extractHeader(ws)
  if (!headerResult.header) {
    return { success: false, errors: headerResult.errors }
  }
  const header = headerResult.header

  // 3. Parsing das linhas de dados
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })
  const dataRows = allRows.slice(HEADER_ROWS)

  const records: PontoRecord[] = []
  const parseErrors: ValidationError[] = []
  const allWarnings: ValidationError[] = []

  for (const row of dataRows) {
    if (!Array.isArray(row)) continue

    const result = parseRow(row as unknown[])

    if (result.type === 'skip') continue

    if (result.type === 'error') {
      parseErrors.push(...result.errors)
      continue
    }

    allWarnings.push(...result.warnings)
    records.push(result.record)
  }

  if (parseErrors.length > 0) {
    return { success: false, errors: [...parseErrors, ...allWarnings] }
  }

  // 4. Validação semântica
  const validationErrors = validate(records)
  const allErrors = [...allWarnings, ...validationErrors]

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors }
  }

  // 5. Cálculo de horas por registro
  const calcErrors: ValidationError[] = []
  for (const record of records) {
    try {
      record.minutesTrabalhados = calculateHours(record)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      calcErrors.push({ dia: record.dia, campo: 'Horas', mensagem: msg })
    }
  }

  if (calcErrors.length > 0) {
    return { success: false, errors: calcErrors }
  }

  // 6. Agrupamento semanal (domingo → sábado)
  const weeks = groupByWeek(records, header.mes, header.ano)

  const totalMensalMinutos = records.reduce(
    (acc, r) => acc + (r.minutesTrabalhados ?? 0),
    0
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
