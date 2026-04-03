// pdfmake e suas dependências (fontkit, pdfkit) contêm classes com referências
// circulares que causam TDZ (Temporal Dead Zone) quando bundladas pelo Vite/esbuild.
// require() no nível do módulo é preservado pelo Vite como chamada CJS de runtime,
// sem bundlar o código — ao contrário de ESM imports que são resolvidos e inlinados.
import type {
  TDocumentDefinitions,
  TFontDictionary,
  Content,
  ContentText,
  TableCell,
  CustomTableLayout,
} from 'pdfmake/interfaces';
import type { PontoData, PontoHeader, TimeEntry, PontoRecord } from '../types/ponto';

/** Tipo mínimo do PdfPrinter para o nosso uso (evita import ESM que seria bundlado). */
type PdfPrinterCtor = new (fonts: TFontDictionary) => {
  createPdfKitDocument(
    docDefinition: TDocumentDefinitions,
  ): NodeJS.ReadableStream & { end(): void; };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake') as PdfPrinterCtor;

// ── Carregamento de fontes a partir do VFS bundlado do pdfmake ────────────────
// vfs_fonts.js faz `module.exports = vfs` diretamente (não { pdfMake: { vfs } })
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfs = require('pdfmake/build/vfs_fonts') as Record<string, string>;

const printer = new PdfPrinter({
  Roboto: {
    normal: Buffer.from(vfs[ 'Roboto-Regular.ttf' ], 'base64'),
    bold: Buffer.from(vfs[ 'Roboto-Medium.ttf' ], 'base64'),
    italics: Buffer.from(vfs[ 'Roboto-Italic.ttf' ], 'base64'),
    bolditalics: Buffer.from(vfs[ 'Roboto-MediumItalic.ttf' ], 'base64'),
  },
});

// ── Constantes de layout ──────────────────────────────────────────────────────
//
// A4: 595.28 × 841.89 pt  |  margens 15 mm = 42.52 pt  |  largura útil ≈ 510 pt
//
// Colunas: Dia | DiaSemana | Entrada | InicioInt | FimInt | Saída | TotSemana | Assinatura | Justificativa
const COL_WIDTHS: (number | string)[] = [ 20, 53, 46, 57, 57, 46, 50, 97, 84 ];
// soma = 510

const PAGE_MARGIN = 42.52; // 15 mm em pontos
const FS = 7;             // font-size padrão da tabela
const FS_INFO = 8;        // font-size do cabeçalho do documento
const FS_TITLE = 12;      // font-size do título

const MESES: Record<number, string> = {
  1: 'JANEIRO', 2: 'FEVEREIRO', 3: 'MARÇO', 4: 'ABRIL',
  5: 'MAIO', 6: 'JUNHO', 7: 'JULHO', 8: 'AGOSTO',
  9: 'SETEMBRO', 10: 'OUTUBRO', 11: 'NOVEMBRO', 12: 'DEZEMBRO',
};

// ── Utilitários ───────────────────────────────────────────────────────────────

function fmtTime(entry: TimeEntry | null): string {
  if (!entry) return '';
  return `${String(entry.hora).padStart(2, '0')}:${String(entry.minuto).padStart(2, '0')}`;
}

/** Cria um ContentText padrão para célula da tabela. */
function tc(
  text: string,
  opts: {
    bold?: boolean;
    alignment?: 'left' | 'center' | 'right';
    fontSize?: number;
  } = {}
): ContentText {
  return {
    text,
    fontSize: opts.fontSize ?? FS,
    bold: opts.bold ?? false,
    alignment: opts.alignment ?? 'center',
  };
}

// ── Construção do corpo da tabela ─────────────────────────────────────────────

function buildTableBody(data: PontoData): TableCell[][] {
  const headerRow: TableCell[] = [
    tc('DIA', { bold: true }),
    tc('DIA DA\nSEMANA', { bold: true }),
    tc('ENTRADA', { bold: true }),
    tc('INÍCIO\nINTERVALO', { bold: true }),
    tc('FIM\nINTERVALO', { bold: true }),
    tc('SAÍDA', { bold: true }),
    tc('TOTAL\nSEMANA', { bold: true }),
    tc('ASSINATURA', { bold: true }),
    tc('JUSTIFICATIVA', { bold: true }),
  ];

  // Dia de fechamento de cada semana → total formatado
  const weekTotals = new Map<number, string>();
  for (const week of data.weeks) {
    weekTotals.set(week.fim, week.totalFormatado);
  }

  const dataRows: TableCell[][] = data.records.map((rec: PontoRecord) => {
    const totalSemana = weekTotals.get(rec.dia) ?? '';
    const folga = rec.folga;

    return [
      tc(String(rec.dia)),
      tc(rec.diaSemana),
      tc(folga ? 'FOLGA' : fmtTime(rec.entrada), { bold: folga }),
      tc(folga ? 'FOLGA' : fmtTime(rec.inicioIntervalo), { bold: folga }),
      tc(folga ? 'FOLGA' : fmtTime(rec.fimIntervalo), { bold: folga }),
      tc(folga ? 'FOLGA' : fmtTime(rec.saida), { bold: folga }),
      tc(totalSemana, { bold: !!totalSemana, fontSize: totalSemana ? 8 : FS }),
      tc(' ', { fontSize: 10 }), // Assinatura — espaço para preenchimento manual
      tc(''),                    // Justificativa — espaço para preenchimento manual
    ];
  });

  return [ headerRow, ...dataRows ];
}

// ── Layout da tabela ──────────────────────────────────────────────────────────

const tableLayout: CustomTableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#000000',
  vLineColor: () => '#000000',
  paddingLeft: () => 2,
  paddingRight: () => 2,
  paddingTop: () => 1,
  paddingBottom: () => 1,
};

// ── Gerador principal ─────────────────────────────────────────────────────────

/** Cabeçalho com logo à esquerda (como no template Excel) ou só texto centralizado. */
function buildTitleSection(header: PontoHeader, logoBuffer?: Buffer): Content[] {
  const titulo: Content = {
    text: 'FOLHA DE PONTO — CONTROLE DE PRESENÇA',
    fontSize: FS_TITLE,
    bold: true,
    alignment: 'center',
    margin: [ 0, 0, 0, 2 ] as [ number, number, number, number ],
  };
  const empresaLinha: Content = {
    text: header.empresa.toUpperCase(),
    fontSize: 9,
    bold: true,
    alignment: 'center',
    margin: [ 0, 0, 0, 0 ] as [ number, number, number, number ],
  };

  if (!logoBuffer?.length) {
    return [
      titulo,
      {
        ...empresaLinha,
        margin: [ 0, 0, 0, 6 ] as [ number, number, number, number ],
      },
    ];
  }

  const logoDataUri = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;

  return [
    {
      columns: [
        {
          image: logoDataUri,
          width: 30,
          margin: [ 0, 0, 10, 0 ] as [ number, number, number, number ],
        },
        {
          width: '*',
          stack: [ titulo, empresaLinha ],
        },
      ],
      margin: [ 0, 0, 0, 6 ] as [ number, number, number, number ],
    },
  ];
}

/**
 * Gera um PDF A4 vertical com a folha de ponto completa.
 * Retorna o buffer do PDF pronto para ser salvo em disco.
 */
export async function generatePdf(
  data: PontoData,
  logoBuffer?: Buffer
): Promise<Buffer> {
  const { header } = data;
  const mesNome = MESES[ header.mes ] ?? String(header.mes);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [ PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN ],

    defaultStyle: { font: 'Roboto' },

    content: [
      // ── Logo + título e empresa ─────────────────────────────────────
      ...buildTitleSection(header, logoBuffer),

      // ── Dados do funcionário ────────────────────────────────────────
      {
        columns: [
          {
            text: `FUNCIONÁRIO: ${header.nome}`,
            fontSize: FS_INFO,
            bold: true,
            width: '*',
          },
          {
            text: `SEÇÃO: ${header.secao}`,
            fontSize: FS_INFO,
            bold: true,
            width: 'auto',
          },
        ],
        margin: [ 0, 0, 0, 2 ] as [ number, number, number, number ],
      },
      {
        text: `${mesNome} / ${header.ano}`,
        fontSize: FS_INFO,
        bold: true,
        margin: [ 0, 0, 0, 6 ] as [ number, number, number, number ],
      },

      // ── Tabela principal ────────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          // Impede que uma linha seja partida entre duas páginas (ex: meses com 31 dias)
          dontBreakRows: true,
          widths: COL_WIDTHS,
          body: buildTableBody(data),
        },
        layout: tableLayout,
      },

      // ── Rodapé ──────────────────────────────────────────────────────
      {
        columns: [
          {
            text: `TOTAL MENSAL: ${data.totalMensalFormatado}`,
            fontSize: FS_INFO,
            bold: true,
            width: 'auto',
          },
          {
            text: 'DATA: _____ / _____ / _________',
            fontSize: FS_INFO,
            alignment: 'center' as const,
            width: '*',
          },
          {
            text: 'ASSINATURA DO SUPERVISOR: ___________________________',
            fontSize: FS_INFO,
            alignment: 'right',
            width: 'auto',
          },
        ],
        margin: [ 0, 10, 0, 0 ] as [ number, number, number, number ],
      },
    ],
  };

  const doc = printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = doc as any;
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err: Error) => reject(err));
    stream.end();
  });
}
