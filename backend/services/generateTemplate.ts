import ExcelJS from 'exceljs'
import type { PontoHeader } from '../types/ponto'
import type { DiaSemana } from '../utils/dateUtils'
import { getDayName, getDaysInMonth } from '../utils/dateUtils'

const EMPRESA = 'PROTMAX SERVIÇOS EM CONDOMÍNIO'
const TITULO = 'FOLHA DE PONTO - CONTROLE DE PRESENÇA'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const COL_WIDTHS = [6, 16, 12, 18, 16, 12]
const NUM_COLS = 6
const LAST_COL_LETTER = 'F'


/** Borda fina em todos os lados */
function thinBorder(): Partial<ExcelJS.Borders> {
  const thin = { style: 'thin' as ExcelJS.BorderStyle }
  return { top: thin, left: thin, bottom: thin, right: thin }
}

/** Aplica estilos básicos a todas as células de uma linha */
function applyRowStyle(
  row: ExcelJS.Row,
  opts: {
    fontSize?: number
    bold?: boolean
    bgColor?: string
    fontColor?: string
    hAlign?: ExcelJS.Alignment['horizontal']
    height?: number
    wrapText?: boolean
  }
): void {
  const {
    fontSize = 10,
    bold = false,
    bgColor,
    fontColor = 'FF000000',
    hAlign = 'center',
    height = 18,
    wrapText = false
  } = opts

  row.height = height

  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: 'Arial', size: fontSize, bold, color: { argb: fontColor } }
    cell.alignment = { vertical: 'middle', horizontal: hAlign, wrapText }
    cell.border = thinBorder()
    if (bgColor) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
    }
  })
}

/**
 * Gera o template Excel de folha de ponto para o mês/ano informado.
 * @param header  Dados do cabeçalho (nome, seção, mês, ano)
 * @param logoBuffer  Buffer da imagem da logo (opcional)
 */
export async function generateTemplate(
  header: PontoHeader,
  logoBuffer?: Buffer
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PontoApp'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Folha de Ponto')

  sheet.columns = COL_WIDTHS.map((width) => ({ width }))

  // ── Linha 1: Logo + Título ────────────────────────────────────────────────
  // Com logo: linha mais alta, logo à esquerda, título à direita
  // Sem logo: título ocupa a linha inteira
  if (logoBuffer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageId = workbook.addImage({ buffer: logoBuffer, extension: 'jpeg' } as any)

    sheet.addRow([null, null, TITULO, null, null, null])
    sheet.mergeCells('C1:F1')

    // Imagem posicionada nas colunas A-B, linha 1 (índices 0-based; br é canto inferior direito)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 1 } } as any)

    sheet.getRow(1).height = 40

    // Aplica estilo apenas às células C1:F1 (onde fica o título)
    const tituloRow = sheet.getRow(1)
    tituloRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber < 3) return
      cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF1F497D' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = thinBorder()
    })

    // Células A1:B1 com fundo branco e borda
    for (const col of ['A', 'B']) {
      const cell = sheet.getCell(`${col}1`)
      cell.border = thinBorder()
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    }
  } else {
    sheet.addRow([TITULO, null, null, null, null, null])
    sheet.mergeCells(`A1:${LAST_COL_LETTER}1`)
    applyRowStyle(sheet.getRow(1), {
      fontSize: 13,
      bold: true,
      bgColor: 'FF2E75B6',
      fontColor: 'FFFFFFFF',
      height: 28
    })
  }

  // ── Linha 2: Empresa ─────────────────────────────────────────────────────
  sheet.addRow([`EMPRESA: ${EMPRESA}`, null, null, null, null, null])
  sheet.mergeCells(`A2:${LAST_COL_LETTER}2`)
  applyRowStyle(sheet.getRow(2), {
    fontSize: 10,
    bold: true,
    bgColor: 'FFD6E4F0',
    height: 18
  })

  // ── Linha 3: Funcionário (linha inteira — evita perder SEÇÃO no LibreOffice com A|D mesclado) ──
  sheet.addRow([`FUNCIONÁRIO: ${header.nome}`, null, null, null, null, null])
  sheet.mergeCells(`A3:${LAST_COL_LETTER}3`)
  applyRowStyle(sheet.getRow(3), {
    fontSize: 10,
    bgColor: 'FFD6E4F0',
    hAlign: 'left',
    height: 18
  })

  // ── Linha 4: Seção (linha inteira) ───────────────────────────────────────
  sheet.addRow([`SEÇÃO: ${header.secao}`, null, null, null, null, null])
  sheet.mergeCells(`A4:${LAST_COL_LETTER}4`)
  applyRowStyle(sheet.getRow(4), {
    fontSize: 10,
    bgColor: 'FFD6E4F0',
    hAlign: 'left',
    height: 18
  })

  // ── Linha 5: Mês/ano (A5:B5; C5:F5 vazio mesclado) ───────────────────────
  const mesNome = MESES[header.mes - 1] ?? String(header.mes)
  sheet.addRow([`${mesNome} / ${header.ano}`, null, null, null, null, null])
  sheet.mergeCells('A5:B5')
  sheet.mergeCells(`C5:${LAST_COL_LETTER}5`)
  applyRowStyle(sheet.getRow(5), {
    fontSize: 10,
    bold: true,
    bgColor: 'FFD6E4F0',
    hAlign: 'left',
    height: 18
  })

  // ── Linha 6: Cabeçalho da tabela ─────────────────────────────────────────
  sheet.addRow(['DIA', 'DIA DA SEMANA', 'ENTRADA', 'INÍCIO INTERVALO', 'FIM INTERVALO', 'SAÍDA'])
  applyRowStyle(sheet.getRow(6), {
    fontSize: 9,
    bold: true,
    bgColor: 'FF1F497D',
    fontColor: 'FFFFFFFF',
    height: 20,
    wrapText: true
  })

  // ── Linhas de dados: um por dia do mês ───────────────────────────────────
  const totalDias = getDaysInMonth(header.mes, header.ano)

  for (let dia = 1; dia <= totalDias; dia++) {
    const diaSemana: DiaSemana = getDayName(dia, header.mes, header.ano)
    const isWeekend = diaSemana === 'DOMINGO' || diaSemana === 'SÁBADO'

    // Usa o retorno direto de addRow para garantir que estilização e
    // dados se referem exatamente à mesma linha
    const dataRow = sheet.addRow([dia, diaSemana, null, null, null, null])
    const bgColor = isWeekend ? 'FFDCE6F1' : undefined

    applyRowStyle(dataRow, { fontSize: 9, bgColor, height: 16 })

    // Alinhamentos das colunas fixas
    dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' }
    dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }

    // Formato hh:mm para colunas de horário (C=3, D=4, E=5, F=6)
    for (let colIdx = 3; colIdx <= 6; colIdx++) {
      const cell = dataRow.getCell(colIdx)
      cell.numFmt = 'hh:mm'
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()

  if (Buffer.isBuffer(buffer)) return buffer
  return Buffer.from(buffer as ArrayBuffer)
}

/** Valida os campos obrigatórios antes de gerar o template. */
export function validateHeader(header: PontoHeader): string[] {
  const erros: string[] = []

  if (!header.nome?.trim()) erros.push('Nome é obrigatório')
  if (!header.secao?.trim()) erros.push('Seção é obrigatória')
  if (header.mes < 1 || header.mes > 12) erros.push('Mês deve ser entre 1 e 12')
  if (header.ano < 2000 || header.ano > 2100) erros.push('Ano inválido')

  return erros
}

/** Gera o nome sugerido para o arquivo ao salvar. */
export function suggestFileName(header: PontoHeader): string {
  const MESES_ABREV = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'
  ]
  const mesAbrev = MESES_ABREV[header.mes - 1] ?? String(header.mes)
  const nomeSeguro = header.nome.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  return `ponto_${nomeSeguro}_${mesAbrev}_${header.ano}.xlsx`
}

export { NUM_COLS }
