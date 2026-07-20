# Remover Feature de Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Excel template generation / import flow entirely, leaving the manual editor as the only path to generate a PDF timesheet.

**Architecture:** Task 1 removes everything on the backend/main-process side (`tsconfig.node.json` project: `backend/**`, `src/main/**`, `src/preload/**`), which is self-contained and testable independently. Task 2 removes the renderer-side type mirror and UI (`tsconfig.web.json` project: `src/renderer/**`), which depends on nothing from Task 1 at the type level (the renderer's `electron.d.ts` is a hand-mirrored type, not an import from `backend/`) but must be done as one unit since `PontoTab.tsx` and `electron.d.ts` compile together.

**Tech Stack:** TypeScript, Vitest, Electron/React (renderer).

## Global Constraints

- This is a purely subtractive change — no new behavior, no compatibility flags. The manual-editor → PDF flow must work exactly as it does today after the removal.
- `pnpm test` and `pnpm build` must pass after every task.
- No file outside the ones listed below may change.

---

## File Structure

- Delete `backend/services/generateTemplate.ts`, `backend/services/generateTemplate.test.ts`.
- Delete `backend/services/processExcel.ts` (no dedicated test file exists for it).
- Delete `backend/validators/excelValidator.ts`, `backend/validators/excelValidator.test.ts`.
- Modify `backend/utils/timeUtils.ts` (+ `.test.ts`): remove `parseExcelTime` and its `createValidationError` helper.
- Modify `src/main/ipc/handlers.ts`: remove the `generate-template` and `process-excel` IPC handlers and their now-unused imports.
- Modify `src/preload/index.ts`: remove the `generateTemplate` and `processExcel` bridge methods.
- Modify `package.json`: remove the `xlsx` and `exceljs` dependencies.
- Modify `src/renderer/types/electron.d.ts`: remove `TemplateResult`, `ProcessResult`, and the two matching `PontoAPI` method signatures.
- Modify `src/renderer/components/PontoTab.tsx` (+ `.test.tsx`): remove all Excel-flow state/handlers/UI, plus already-dead `doneOps`/`markDone` state and unused style objects.

---

### Task 1: Backend and main-process removal

**Files:**
- Delete: `backend/services/generateTemplate.ts`
- Delete: `backend/services/generateTemplate.test.ts`
- Delete: `backend/services/processExcel.ts`
- Delete: `backend/validators/excelValidator.ts`
- Delete: `backend/validators/excelValidator.test.ts`
- Modify: `backend/utils/timeUtils.ts`
- Modify: `backend/utils/timeUtils.test.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: nothing new. After this task, `backend/utils/timeUtils.ts` exports only `MINUTES_IN_DAY`, `toMinutes`, `normalizeSequentialMinutes`, `formatMinutes` (used by `calculateHours.ts` and `groupByWeek.ts`, both untouched by this plan).

- [ ] **Step 1: Delete the three Excel-only backend files**

```bash
rm backend/services/generateTemplate.ts
rm backend/services/generateTemplate.test.ts
rm backend/services/processExcel.ts
rm backend/validators/excelValidator.ts
rm backend/validators/excelValidator.test.ts
```

- [ ] **Step 2: Remove `parseExcelTime` from `timeUtils.ts` and its test**

In `backend/utils/timeUtils.test.ts`, delete the entire `describe('parseExcelTime', ...)` block (everything from `describe('parseExcelTime', () => {` through its closing `})`, i.e. lines 4-50 of the current file), keeping only the `describe('time helpers', ...)` block. The file should read:

```ts
import { describe, expect, it } from 'vitest'
import { formatMinutes, toMinutes } from './timeUtils'

describe('time helpers', () => {
  it('converts time entries to minutes', () => {
    expect(toMinutes({ hora: 7, minuto: 30 })).toBe(450)
  })

  it('formats positive and negative minute totals', () => {
    expect(formatMinutes(485)).toBe('08:05')
    expect(formatMinutes(-75)).toBe('-01:15')
  })
})
```

This is a pure deletion (no new behavior to drive with a failing test) — instead of RED/GREEN, remove the implementation in the same step and verify with the full run in Step 5.

In `backend/utils/timeUtils.ts`, remove the `parseExcelTime` function and the `createValidationError` helper it uses (lines 16-79 of the current file), keeping the rest. The file should read:

```ts
import type { TimeEntry } from '../types/ponto'

export const MINUTES_IN_DAY = 24 * 60

/** Converte TimeEntry em minutos desde meia-noite. */
export function toMinutes(entry: TimeEntry): number {
  return entry.hora * 60 + entry.minuto
}

/**
 * Converte horarios de uma jornada em uma linha do tempo continua.
 *
 * Quando um horario fica menor que o anterior, ele e interpretado como
 * pertencente ao dia seguinte. Ex.: 22:00, 01:00, 02:00 => 1320, 1500, 1560.
 */
export function normalizeSequentialMinutes(entries: TimeEntry[]): number[] {
  const minutes: number[] = []
  let dayOffset = 0

  for (const entry of entries) {
    let current = toMinutes(entry) + dayOffset
    const previous = minutes[minutes.length - 1]

    if (previous !== undefined && current < previous) {
      dayOffset += MINUTES_IN_DAY
      current += MINUTES_IN_DAY
    }

    minutes.push(current)
  }

  return minutes
}

/** Converte total de minutos para string "HH:mm". */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 0) {
    const abs = Math.abs(totalMinutes)
    const hh = Math.floor(abs / 60)
    const mm = abs % 60
    return `-${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
```

Note: `ValidationError` was only imported for `parseExcelTime`'s signature — the new file only imports `TimeEntry`.

- [ ] **Step 3: Remove the Excel IPC handlers from `handlers.ts`**

In `src/main/ipc/handlers.ts`, remove these three import lines (lines 4-9 of the current file):

```ts
import {
  generateTemplate,
  validateHeader,
  suggestFileName
} from '../../../backend/services/generateTemplate'
import { processExcel } from '../../../backend/services/processExcel'
```

so the import block becomes:

```ts
import { buildPontoDataFromManualInput } from '../../../backend/services/buildPontoDataFromManualInput'
import { generatePdf } from '../../../backend/services/generatePdf'
```

(keep every other import in that block as-is — `buildPontoDataFromManualInput`, `generatePdf`, the `localDataStore` imports, `backupStore` imports, and the `types/ponto` imports all stay).

Remove the entire `generate-template` handler block (the `// ── Fase 3: Geração do template Excel ──` comment through the handler's closing `})`, currently lines 65-105):

```ts
  // ── Fase 3: Geração do template Excel ──────────────────────────────────
  ipcMain.handle('generate-template', async (event, input: PontoHeader | { header: PontoHeader; logoPath?: string }) => {
    const data = 'header' in input ? input.header : input
    const logoPath = 'header' in input ? input.logoPath : undefined
    const erros = validateHeader(data)
    if (erros.length > 0) {
      return { success: false, error: erros.join('; ') }
    }

    let buffer: Buffer
    try {
      const logoBuffer = await loadLogoFromPath(logoPath)
      buffer = await generateTemplate(data, logoBuffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao gerar o template: ${msg}` }
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    const { filePath, canceled } = await dialog.showSaveDialog(
      win ?? BrowserWindow.getFocusedWindow()!,
      {
        title: 'Salvar Template de Ponto',
        defaultPath: suggestFileName(data),
        filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }]
      }
    )

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    try {
      await fs.writeFile(filePath, buffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao salvar o arquivo: ${msg}` }
    }

    return { success: true, filePath }
  })

```

And remove the entire `process-excel` handler block (the `// ── Fase 4-5: Processamento do Excel ──` comment through its closing `})`, currently lines 107-133):

```ts
  // ── Fase 4-5: Processamento do Excel ───────────────────────────────────
  ipcMain.handle('process-excel', async (event, filePath?: string) => {
    if (!filePath) {
      const win = BrowserWindow.fromWebContents(event.sender)
      const { filePaths, canceled } = await dialog.showOpenDialog(
        win ?? BrowserWindow.getFocusedWindow()!,
        {
          title: 'Selecionar Planilha de Ponto',
          filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
          properties: ['openFile'],
        }
      )

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      filePath = filePaths[0]
    }

    try {
      return await processExcel(filePath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Erro ao processar a planilha: ${msg}` }
    }
  })

```

Everything else in `handlers.ts` (`build-ponto-data`, `generate-pdf`, the cadastros handlers, the backup handlers, `loadLogo`/`loadLogoFromPath`) stays unchanged.

- [ ] **Step 4: Remove the Excel bridge methods from `preload/index.ts`**

In `src/preload/index.ts`, remove these two entries from the `pontoAPI` object:

```ts
  generateTemplate: (data: unknown): Promise<unknown> =>
    ipcRenderer.invoke('generate-template', data),

  processExcel: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('process-excel', filePath),

```

so `pontoAPI` starts directly with `buildPontoData`:

```ts
const pontoAPI = {
  buildPontoData: (input: unknown): Promise<unknown> =>
    ipcRenderer.invoke('build-ponto-data', input),

  generatePdf: (data: unknown): Promise<unknown> =>
    ipcRenderer.invoke('generate-pdf', data),

  ...
```

- [ ] **Step 5: Run the backend/main test suite and build**

Run: `npx vitest run backend src/main src/preload`
Expected: All tests pass (the deleted test files no longer run; `timeUtils.test.ts` passes with only the `time helpers` describe block).

Run: `pnpm build`
Expected: Succeeds with no TypeScript errors.

- [ ] **Step 6: Remove the now-unused `xlsx` and `exceljs` dependencies**

```bash
pnpm remove xlsx exceljs
```

Run: `pnpm test && pnpm build`
Expected: All tests pass; build succeeds (confirms nothing else in the project imports either package).

- [ ] **Step 7: Commit**

```bash
git add -A -- backend/services/generateTemplate.ts backend/services/generateTemplate.test.ts backend/services/processExcel.ts backend/validators/excelValidator.ts backend/validators/excelValidator.test.ts backend/utils/timeUtils.ts backend/utils/timeUtils.test.ts src/main/ipc/handlers.ts src/preload/index.ts package.json pnpm-lock.yaml
git commit -m "feat: remove Excel template/import backend and IPC layer"
```

---

### Task 2: Renderer removal

**Files:**
- Modify: `src/renderer/types/electron.d.ts`
- Modify: `src/renderer/components/PontoTab.tsx`
- Modify: `src/renderer/components/PontoTab.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 (the renderer's types are a hand-mirrored copy, not an import from `backend/`).
- Produces: nothing new — this task only removes.

- [ ] **Step 1: Remove the Excel types from `electron.d.ts`**

In `src/renderer/types/electron.d.ts`, remove the `TemplateResult` and `ProcessResult` interfaces (currently lines 73-86):

```ts
export interface TemplateResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface ProcessResult {
  success: boolean
  canceled?: boolean
  data?: unknown
  error?: string
  errors?: Array<{ dia: number; campo: string; mensagem: string }>
}

```

so `BuildPontoDataResult` follows directly after `EmployeeDefaultSchedule`/`Section`/`LocalData` (i.e. right before `PdfResult`).

Remove the `generateTemplate` and `processExcel` entries from the `PontoAPI` interface (currently lines 103-107):

```ts
  generateTemplate: (input: {
    header: PontoHeader
    logoPath?: string
  }) => Promise<TemplateResult>
  processExcel: (filePath: string) => Promise<ProcessResult>
```

so `PontoAPI` starts with:

```ts
export interface PontoAPI {
  buildPontoData: (input: {
    header: PontoHeader
    records: ManualPontoRecordInput[]
  }) => Promise<BuildPontoDataResult>
  ...
```

- [ ] **Step 2: Write the failing test for the removed UI**

In `src/renderer/components/PontoTab.test.tsx`, change the "renders the in-app editor actions" test from:

```ts
  it('renders the in-app editor actions', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('Aplicar horário padrão')
    expect(html).toContain('Gerar PDF')
    expect(html).toContain('Usar planilha Excel')
  })
```

to:

```ts
  it('renders the in-app editor actions', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('Aplicar horário padrão')
    expect(html).toContain('Gerar PDF')
    expect(html).not.toContain('Usar planilha Excel')
  })
```

Run: `npx vitest run src/renderer/components/PontoTab.test.tsx`
Expected: FAIL — `'Usar planilha Excel'` is still present in the current markup, so `.not.toContain` fails.

- [ ] **Step 3: Remove the Excel state, handlers, and UI from `PontoTab.tsx`**

In `src/renderer/components/PontoTab.tsx`, change the type-only import block from:

```ts
import type {
  BuildPontoDataResult,
  Employee,
  Organization,
  PdfResult,
  PontoHeader,
  ProcessResult,
  TemplateResult,
} from '../types/electron'
```

to:

```ts
import type {
  BuildPontoDataResult,
  Employee,
  Organization,
  PdfResult,
  PontoHeader,
} from '../types/electron'
```

Change the `Operacao` type from:

```ts
type Operacao = 'planilha' | 'excel' | 'pdf' | 'validacao'
```

to:

```ts
type Operacao = 'pdf' | 'validacao'
```

Remove the `excelData` and `doneOps` state declarations. Change:

```ts
  const [horarioFontSize, setHorarioFontSize] = useState(DEFAULT_HORARIO_FONT_SIZE)
  const [excelData, setExcelData] = useState<unknown>(null)
  const [rows, setRows] = useState<PontoEditorRow[]>(() =>
    createMonthlyRows(mes, ANO_ATUAL),
  )
  const [doneOps, setDoneOps] = useState<Set<Operacao>>(new Set())
  const [status, setStatus] = useState<Status>({ tipo: 'idle' })
```

to:

```ts
  const [horarioFontSize, setHorarioFontSize] = useState(DEFAULT_HORARIO_FONT_SIZE)
  const [rows, setRows] = useState<PontoEditorRow[]>(() =>
    createMonthlyRows(mes, ANO_ATUAL),
  )
  const [status, setStatus] = useState<Status>({ tipo: 'idle' })
```

Remove the `podeGerarPlanilha`/`podeGerarPdf` derived state. Change:

```ts
  const isLoading = status.tipo === 'loading'
  const podeGerarPlanilha =
    !isLoading && !!selectedOrganization && !!selectedEmployee
  const podeGerarPdf = !isLoading && excelData !== null
```

to:

```ts
  const isLoading = status.tipo === 'loading'
```

Change the mes/employee reset effect from:

```ts
  useEffect(() => {
    setRows(createMonthlyRows(mes, ANO_ATUAL))
    setExcelData(null)
    setDoneOps(new Set())
  }, [mes, selectedEmployeeId, selectedOrganizationId])
```

to:

```ts
  useEffect(() => {
    setRows(createMonthlyRows(mes, ANO_ATUAL))
  }, [mes, selectedEmployeeId, selectedOrganizationId])
```

Remove the `markDone` function entirely:

```ts
  function markDone(op: Operacao): void {
    setDoneOps((prev) => new Set([...prev, op]))
  }

```

In `handleGerarPdfDireto`, remove the `markDone('pdf')` call. Change:

```ts
      markDone('pdf')
      setStatus({
        tipo: 'sucesso',
        operacao: 'pdf',
        filePath: pdfResult.filePath,
      })
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'pdf',
        mensagem:
          err instanceof Error ? err.message : 'Erro inesperado ao gerar PDF.',
      })
    }
  }

  async function handleGerarPlanilha(): Promise<void> {
```

(this is the end of `handleGerarPdfDireto` followed by the start of `handleGerarPlanilha`) to:

```ts
      setStatus({
        tipo: 'sucesso',
        operacao: 'pdf',
        filePath: pdfResult.filePath,
      })
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'pdf',
        mensagem:
          err instanceof Error ? err.message : 'Erro inesperado ao gerar PDF.',
      })
    }
  }
```

Delete the three Excel handlers entirely — `handleGerarPlanilha`, `handleSelecionarExcel`, and the Excel-flow `handleGerarPdf` (everything from `async function handleGerarPlanilha` through the closing `}` of `handleGerarPdf`, immediately before `function dismissErro`):

```ts
  async function handleGerarPlanilha(): Promise<void> {
    if (!podeGerarPlanilha || !selectedOrganization || !selectedEmployee) return
    setStatus({ tipo: 'loading', operacao: 'planilha' })

    const header: PontoHeader = {
      empresa: selectedOrganization.nome,
      nome: selectedEmployee.nome,
      secao: selectedEmployee.setor,
      funcao: selectedEmployee.cargoFuncao,
      mes,
      ano: ANO_ATUAL,
    }

    try {
      const resultado = (await window.pontoAPI.generateTemplate({
        header,
        logoPath: selectedOrganization.logoPath,
      })) as TemplateResult
      if (resultado.canceled) {
        setStatus({ tipo: 'idle' })
        return
      }
      if (!resultado.success) {
        setStatus({
          tipo: 'erro',
          operacao: 'planilha',
          mensagem: resultado.error ?? 'Não foi possível gerar a planilha.',
        })
        return
      }
      markDone('planilha')
      setStatus({
        tipo: 'sucesso',
        operacao: 'planilha',
        filePath: resultado.filePath,
      })
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'planilha',
        mensagem:
          err instanceof Error
            ? err.message
            : 'Erro inesperado ao gerar planilha.',
      })
    }
  }

  async function handleSelecionarExcel(): Promise<void> {
    setStatus({ tipo: 'loading', operacao: 'excel' })

    try {
      const resultado = (await window.pontoAPI.processExcel('')) as ProcessResult
      if (resultado.canceled) {
        setStatus({ tipo: 'idle' })
        return
      }
      if (!resultado.success) {
        const lista = resultado.errors?.map((e) => e.mensagem)
        const mensagem =
          lista && lista.length > 0
            ? `${lista.length} erro(s) encontrado(s) na planilha`
            : (resultado.error ?? 'Não foi possível processar o arquivo.')
        setStatus({ tipo: 'erro', operacao: 'excel', mensagem, lista })
        return
      }
      setExcelData(resultado.data)
      markDone('excel')
      setStatus({ tipo: 'sucesso', operacao: 'excel' })
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'excel',
        mensagem:
          err instanceof Error
            ? err.message
            : 'Erro inesperado ao processar arquivo.',
      })
    }
  }

  async function handleGerarPdf(): Promise<void> {
    if (!podeGerarPdf) return
    setStatus({ tipo: 'loading', operacao: 'pdf' })

    try {
      const resultado = (await window.pontoAPI.generatePdf({
        data: excelData,
        logoPath: selectedOrganization?.logoPath,
        horarioFontSize,
      })) as PdfResult
      if (resultado.canceled) {
        setStatus({ tipo: 'idle' })
        return
      }
      if (!resultado.success) {
        setStatus({
          tipo: 'erro',
          operacao: 'pdf',
          mensagem: resultado.error ?? 'Não foi possível gerar o PDF.',
        })
        return
      }
      markDone('pdf')
      setStatus({
        tipo: 'sucesso',
        operacao: 'pdf',
        filePath: resultado.filePath,
      })
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'pdf',
        mensagem:
          err instanceof Error ? err.message : 'Erro inesperado ao gerar PDF.',
      })
    }
  }

```

Remove the entire `<details>` "Usar planilha Excel" block and the Excel-loaded badge, i.e. everything from `<details style={s.excelDetails}>` through the closing `)}` of the `excelData !== null` badge:

```tsx
      <details style={s.excelDetails}>
        <summary style={s.excelSummary}>Usar planilha Excel</summary>
        <div style={s.botoes}>
          <button
            onClick={handleGerarPlanilha}
            disabled={!podeGerarPlanilha}
            title={
              !selectedOrganization || !selectedEmployee
                ? 'Selecione empresa e funcionário primeiro'
                : ''
            }
            style={{
              ...s.botao,
              ...s.botaoAzul,
              ...(!podeGerarPlanilha ? s.botaoDesabilitado : {}),
            }}
          >
            {isLoading && status.operacao === 'planilha' ? (
              <>
                <span className='spinner' />
                Gerando…
              </>
            ) : (
              '① Gerar Planilha'
            )}
          </button>

          <button
            onClick={handleSelecionarExcel}
            disabled={isLoading}
            style={{
              ...s.botao,
              ...s.botaoVerde,
              ...(isLoading ? s.botaoDesabilitado : {}),
            }}
          >
            {isLoading && status.operacao === 'excel' ? (
              <>
                <span className='spinner' />
                Processando…
              </>
            ) : (
              '② Selecionar Excel'
            )}
          </button>

          <button
            onClick={handleGerarPdf}
            disabled={!podeGerarPdf}
            title={!podeGerarPdf ? 'Selecione um Excel primeiro' : ''}
            style={{
              ...s.botao,
              ...s.botaoLaranja,
              ...(!podeGerarPdf ? s.botaoDesabilitado : {}),
            }}
          >
            {isLoading && status.operacao === 'pdf' ? (
              <>
                <span className='spinner' />
                Gerando PDF…
              </>
            ) : (
              '③ Gerar PDF'
            )}
          </button>
        </div>
      </details>

      {excelData !== null && (
        <div style={s.badgeExcel}>✓ Planilha carregada — pronta para gerar PDF</div>
      )}

```

so the JSX goes directly from the closing `</div>` of `editorTable` to the `status.tipo === 'loading'` block.

Update the status message dictionaries to drop the `planilha`/`excel` keys. Change:

```ts
          {
            {
              planilha: 'Gerando planilha…',
              excel: 'Processando arquivo…',
              validacao: 'Validando grade…',
              pdf: 'Gerando PDF…',
            }[status.operacao]
          }
```

to:

```ts
          {
            {
              validacao: 'Validando grade…',
              pdf: 'Gerando PDF…',
            }[status.operacao]
          }
```

Change:

```ts
            {
              {
                planilha: '✓ Planilha gerada!',
                excel: '✓ Arquivo carregado!',
                validacao: '✓ Grade validada!',
                pdf: '✓ PDF gerado!',
              }[status.operacao]
            }
```

to:

```ts
            {
              {
                validacao: '✓ Grade validada!',
                pdf: '✓ PDF gerado!',
              }[status.operacao]
            }
```

Change:

```ts
              {
                {
                  planilha: 'Erro ao gerar planilha',
                  excel: 'Erro ao processar Excel',
                  validacao: 'Erro ao validar grade',
                  pdf: 'Erro ao gerar PDF',
                }[status.operacao]
              }
```

to:

```ts
              {
                {
                  validacao: 'Erro ao validar grade',
                  pdf: 'Erro ao gerar PDF',
                }[status.operacao]
              }
```

Finally, remove the now-unused style objects `steps`, `stepLine`, `divider`, `excelDetails`, `excelSummary`, `botoes`, `badgeExcel` from the `s` style object at the bottom of the file. Delete these entries:

```ts
  steps: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    marginBottom: '1.5rem',
  },
  stepLine: {
    flex: 1,
    height: '2px',
    background: '#d9e6f5',
    maxWidth: '60px',
    margin: '0 4px',
    marginBottom: '18px',
  },
  divider: {
    height: '1px',
    background: '#d9e6f5',
    marginBottom: '1.5rem',
  },
```

```ts
  botoes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
```

```ts
  excelDetails: {
    marginTop: '1.25rem',
    borderTop: '1px solid #d9e6f5',
    paddingTop: '0.9rem',
  },
  excelSummary: {
    color: '#07346f',
    cursor: 'pointer',
    fontSize: '0.86rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
  },
```

```ts
  badgeExcel: {
    marginTop: '1rem',
    padding: '0.5rem 0.8rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    color: '#15803d',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/components/PontoTab.test.tsx`
Expected: PASS (all `PontoTab` tests, including the updated one).

- [ ] **Step 5: Run the full test suite and build**

Run: `pnpm test && pnpm build`
Expected: All tests pass; build succeeds with no TypeScript errors (confirms no remaining reference to `ProcessResult`, `TemplateResult`, `excelData`, `podeGerarPlanilha`, `podeGerarPdf`, `handleGerarPlanilha`, `handleSelecionarExcel`, `doneOps`, or `markDone`).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/types/electron.d.ts src/renderer/components/PontoTab.tsx src/renderer/components/PontoTab.test.tsx
git commit -m "feat: remove Excel flow and dead step-tracking state from PontoTab"
```

---

## Acceptance Criteria Recap

- [ ] No reference to `generateTemplate`, `processExcel`, `excelValidator`, `parseExcelTime`, `TemplateResult`, or `ProcessResult` remains anywhere in the codebase.
- [ ] The Ponto tab shows no Excel-related button or section.
- [ ] The manual editor → "Gerar PDF" flow works exactly as before (same fields, font-size selector, Folga/Feriado checkboxes).
- [ ] `xlsx` and `exceljs` no longer appear in `package.json`.
- [ ] `pnpm test` and `pnpm build` pass.
