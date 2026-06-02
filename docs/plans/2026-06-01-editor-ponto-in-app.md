# Editor de Ponto In-App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-employee-at-a-time monthly point editor so users can fill hours and folgas directly in the app and generate PDF without downloading or uploading the Excel model.

**Architecture:** Add a backend builder that converts manual records into the existing `PontoData` contract, then update the renderer to collect/edit those records and call the existing `generatePdf` IPC path. Keep the Excel flow as a secondary compatibility path.

**Tech Stack:** Electron, React, TypeScript, Vitest, existing `generatePdf`, `calculateHours`, `groupByWeek`, `dateUtils`, and `timeUtils`.

---

## File Structure

- Create `backend/services/buildPontoDataFromManualInput.ts`: validates manual rows and returns `ProcessResult`.
- Create `backend/services/buildPontoDataFromManualInput.test.ts`: backend coverage for manual input conversion.
- Modify `backend/types/ponto.ts`: add `ManualPontoRecordInput`.
- Modify `src/renderer/types/electron.d.ts`: mirror `TimeEntry`, `PontoRecord`, `PontoData`, and manual-input types for renderer use.
- Create `src/renderer/components/pontoEditor.ts`: pure helpers for monthly row creation, parsing, validation payload construction, and default schedule application.
- Create `src/renderer/components/pontoEditor.test.ts`: renderer helper coverage.
- Modify `src/renderer/components/PontoTab.tsx`: replace primary stepper with the in-app editor and move Excel actions to a secondary section.
- Modify `src/renderer/components/PontoTab.test.tsx`: static rendering coverage for the new editor.

---

### Task 1: Backend Manual Ponto Builder

**Files:**
- Modify: `backend/types/ponto.ts`
- Create: `backend/services/buildPontoDataFromManualInput.ts`
- Create: `backend/services/buildPontoDataFromManualInput.test.ts`

- [x] **Step 1: Add manual input type**

Add this to `backend/types/ponto.ts` after `PontoRecord`:

```ts
export interface ManualPontoRecordInput {
  dia: number;
  entrada: TimeEntry | null;
  inicioIntervalo: TimeEntry | null;
  fimIntervalo: TimeEntry | null;
  saida: TimeEntry | null;
  folga: boolean;
}
```

- [x] **Step 2: Write failing backend tests**

Create `backend/services/buildPontoDataFromManualInput.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ManualPontoRecordInput, PontoHeader, TimeEntry } from '../types/ponto'
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

function fullMonth(overrides: Partial<ManualPontoRecordInput>[] = []): ManualPontoRecordInput[] {
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
    const result = buildPontoDataFromManualInput(header, [...fullMonth(), workingDay(29)])

    expect(result.success).toBe(false)
    expect(result.errors).toContainEqual({
      dia: 29,
      campo: 'Dia',
      mensagem: 'Dia 29 nao existe em Fevereiro/2026.',
    })
  })
})
```

- [x] **Step 3: Run test to verify it fails**

Run: `pnpm test backend/services/buildPontoDataFromManualInput.test.ts`

Expected: FAIL because `buildPontoDataFromManualInput.ts` does not exist.

- [x] **Step 4: Implement backend builder**

Create `backend/services/buildPontoDataFromManualInput.ts`:

```ts
import { calculateHours } from './calculateHours'
import { groupByWeek } from './groupByWeek'
import type {
  ManualPontoRecordInput,
  PontoData,
  PontoHeader,
  PontoRecord,
  ProcessResult,
  TimeEntry,
  ValidationError,
} from '../types/ponto'
import { getDayName, getDaysInMonth } from '../utils/dateUtils'
import { formatMinutes, toMinutes } from '../utils/timeUtils'

const FIELD_LABELS: Array<[keyof ManualPontoRecordInput, string]> = [
  ['entrada', 'Entrada'],
  ['inicioIntervalo', 'Inicio Intervalo'],
  ['fimIntervalo', 'Fim Intervalo'],
  ['saida', 'Saida'],
]

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function buildPontoDataFromManualInput(
  header: PontoHeader,
  rows: ManualPontoRecordInput[],
): ProcessResult {
  const errors = validateManualRows(header, rows)
  if (errors.length > 0) return { success: false, errors }

  const records: PontoRecord[] = rows
    .slice()
    .sort((a, b) => a.dia - b.dia)
    .map((row) => {
      const record: PontoRecord = {
        dia: row.dia,
        diaSemana: getDayName(row.dia, header.mes, header.ano),
        entrada: row.folga ? null : row.entrada,
        inicioIntervalo: row.folga ? null : row.inicioIntervalo,
        fimIntervalo: row.folga ? null : row.fimIntervalo,
        saida: row.folga ? null : row.saida,
        folga: row.folga,
      }
      return { ...record, minutesTrabalhados: calculateHours(record) }
    })

  const weeks = groupByWeek(records, header.mes, header.ano)
  const totalMensalMinutos = records.reduce(
    (total, record) => total + (record.minutesTrabalhados ?? 0),
    0,
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

function validateManualRows(
  header: PontoHeader,
  rows: ManualPontoRecordInput[],
): ValidationError[] {
  const errors: ValidationError[] = []
  const totalDays = getDaysInMonth(header.mes, header.ano)
  const seen = new Set<number>()

  for (const row of rows) {
    if (row.dia < 1 || row.dia > totalDays) {
      errors.push({
        dia: row.dia,
        campo: 'Dia',
        mensagem: `Dia ${row.dia} nao existe em ${MESES[header.mes - 1]}/${header.ano}.`,
      })
      continue
    }

    if (seen.has(row.dia)) {
      errors.push({
        dia: row.dia,
        campo: 'Dia',
        mensagem: `Dia ${row.dia}: registro duplicado.`,
      })
      continue
    }
    seen.add(row.dia)

    if (row.folga) continue

    for (const [field, label] of FIELD_LABELS) {
      if (!row[field]) {
        errors.push({
          dia: row.dia,
          campo: label,
          mensagem: `Dia ${row.dia}: ${label} e obrigatorio em dia trabalhado.`,
        })
      }
    }

    if (hasAllTimes(row) && !isChronological(row)) {
      errors.push({
        dia: row.dia,
        campo: 'Horarios',
        mensagem: `Dia ${row.dia}: horarios devem seguir a ordem Entrada, Inicio Intervalo, Fim Intervalo e Saida.`,
      })
    }
  }

  for (let dia = 1; dia <= totalDays; dia++) {
    if (!seen.has(dia)) {
      errors.push({
        dia,
        campo: 'Dia',
        mensagem: `Dia ${dia}: registro obrigatorio na grade mensal.`,
      })
    }
  }

  return errors
}

function hasAllTimes(row: ManualPontoRecordInput): row is ManualPontoRecordInput & {
  entrada: TimeEntry;
  inicioIntervalo: TimeEntry;
  fimIntervalo: TimeEntry;
  saida: TimeEntry;
} {
  return !!row.entrada && !!row.inicioIntervalo && !!row.fimIntervalo && !!row.saida
}

function isChronological(row: {
  entrada: TimeEntry;
  inicioIntervalo: TimeEntry;
  fimIntervalo: TimeEntry;
  saida: TimeEntry;
}): boolean {
  return (
    toMinutes(row.entrada) <= toMinutes(row.inicioIntervalo) &&
    toMinutes(row.inicioIntervalo) <= toMinutes(row.fimIntervalo) &&
    toMinutes(row.fimIntervalo) <= toMinutes(row.saida)
  )
}
```

- [x] **Step 5: Run backend test**

Run: `pnpm test backend/services/buildPontoDataFromManualInput.test.ts`

Expected: PASS.

- [x] **Step 6: Commit backend builder**

```bash
git add backend/types/ponto.ts backend/services/buildPontoDataFromManualInput.ts backend/services/buildPontoDataFromManualInput.test.ts
git commit -m "feat: build ponto data from manual input"
```

---

### Task 2: Renderer Editor Helpers

**Files:**
- Modify: `src/renderer/types/electron.d.ts`
- Create: `src/renderer/components/pontoEditor.ts`
- Create: `src/renderer/components/pontoEditor.test.ts`

- [x] **Step 1: Mirror ponto data types in renderer**

Add these interfaces to `src/renderer/types/electron.d.ts` after `PontoHeader`:

```ts
export interface TimeEntry {
  hora: number
  minuto: number
}

export interface ManualPontoRecordInput {
  dia: number
  entrada: TimeEntry | null
  inicioIntervalo: TimeEntry | null
  fimIntervalo: TimeEntry | null
  saida: TimeEntry | null
  folga: boolean
}
```

Change `generatePdf` typing from:

```ts
generatePdf: (input: { data: unknown; logoPath?: string }) => Promise<PdfResult>
```

to:

```ts
generatePdf: (input: { data: unknown; logoPath?: string }) => Promise<PdfResult>
```

Keep `unknown` for now because Excel and manual paths both flow through this boundary; stronger typing can be added after `PontoData` is mirrored fully.

- [x] **Step 2: Write failing helper tests**

Create `src/renderer/components/pontoEditor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyDefaultSchedule,
  createMonthlyRows,
  parseTimeInput,
  serializeRowsForManualInput,
  toggleFolga,
} from './pontoEditor'

describe('pontoEditor helpers', () => {
  it('creates one row per day of the month', () => {
    const rows = createMonthlyRows(2, 2026)

    expect(rows).toHaveLength(28)
    expect(rows[0]).toMatchObject({ dia: 1, diaSemana: 'DOMINGO', folga: false })
    expect(rows[27]).toMatchObject({ dia: 28 })
  })

  it('parses HH:mm input', () => {
    expect(parseTimeInput('08:30')).toEqual({ hora: 8, minuto: 30 })
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput('8:30')).toBeNull()
    expect(parseTimeInput('25:00')).toBeNull()
  })

  it('applies a default schedule only to non-folga rows', () => {
    const rows = toggleFolga(createMonthlyRows(2, 2026), 2, true)
    const result = applyDefaultSchedule(rows, {
      entrada: '08:00',
      inicioIntervalo: '12:00',
      fimIntervalo: '13:00',
      saida: '17:00',
    })

    expect(result[0].entrada).toBe('08:00')
    expect(result[1].entrada).toBe('')
    expect(result[1].folga).toBe(true)
  })

  it('serializes UI rows to manual backend input', () => {
    const rows = applyDefaultSchedule(createMonthlyRows(2, 2026), {
      entrada: '08:00',
      inicioIntervalo: '12:00',
      fimIntervalo: '13:00',
      saida: '17:00',
    })

    expect(serializeRowsForManualInput(rows)[0]).toEqual({
      dia: 1,
      entrada: { hora: 8, minuto: 0 },
      inicioIntervalo: { hora: 12, minuto: 0 },
      fimIntervalo: { hora: 13, minuto: 0 },
      saida: { hora: 17, minuto: 0 },
      folga: false,
    })
  })
})
```

- [x] **Step 3: Run helper test to verify it fails**

Run: `pnpm test src/renderer/components/pontoEditor.test.ts`

Expected: FAIL because `pontoEditor.ts` does not exist.

- [x] **Step 4: Implement helper module**

Create `src/renderer/components/pontoEditor.ts`:

```ts
import type { ManualPontoRecordInput, TimeEntry } from '../types/electron'

const DIAS_SEMANA = [
  'DOMINGO',
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
] as const

export interface PontoEditorRow {
  dia: number
  diaSemana: string
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
  folga: boolean
}

export interface DefaultSchedule {
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
}

export function createMonthlyRows(mes: number, ano: number): PontoEditorRow[] {
  const totalDays = new Date(ano, mes, 0).getDate()
  return Array.from({ length: totalDays }, (_, index) => {
    const dia = index + 1
    const weekDay = new Date(ano, mes - 1, dia).getDay()
    return {
      dia,
      diaSemana: DIAS_SEMANA[weekDay],
      entrada: '',
      inicioIntervalo: '',
      fimIntervalo: '',
      saida: '',
      folga: false,
    }
  })
}

export function parseTimeInput(value: string): TimeEntry | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return { hora: Number(match[1]), minuto: Number(match[2]) }
}

export function toggleFolga(
  rows: PontoEditorRow[],
  dia: number,
  folga: boolean,
): PontoEditorRow[] {
  return rows.map((row) =>
    row.dia === dia
      ? {
          ...row,
          folga,
          entrada: folga ? '' : row.entrada,
          inicioIntervalo: folga ? '' : row.inicioIntervalo,
          fimIntervalo: folga ? '' : row.fimIntervalo,
          saida: folga ? '' : row.saida,
        }
      : row,
  )
}

export function updateRowTime(
  rows: PontoEditorRow[],
  dia: number,
  field: keyof DefaultSchedule,
  value: string,
): PontoEditorRow[] {
  return rows.map((row) =>
    row.dia === dia ? { ...row, [field]: value, folga: false } : row,
  )
}

export function applyDefaultSchedule(
  rows: PontoEditorRow[],
  schedule: DefaultSchedule,
): PontoEditorRow[] {
  return rows.map((row) => (row.folga ? row : { ...row, ...schedule }))
}

export function serializeRowsForManualInput(
  rows: PontoEditorRow[],
): ManualPontoRecordInput[] {
  return rows.map((row) => ({
    dia: row.dia,
    entrada: row.folga ? null : parseTimeInput(row.entrada),
    inicioIntervalo: row.folga ? null : parseTimeInput(row.inicioIntervalo),
    fimIntervalo: row.folga ? null : parseTimeInput(row.fimIntervalo),
    saida: row.folga ? null : parseTimeInput(row.saida),
    folga: row.folga,
  }))
}
```

- [x] **Step 5: Run helper test**

Run: `pnpm test src/renderer/components/pontoEditor.test.ts`

Expected: PASS.

- [x] **Step 6: Commit renderer helpers**

```bash
git add src/renderer/types/electron.d.ts src/renderer/components/pontoEditor.ts src/renderer/components/pontoEditor.test.ts
git commit -m "feat: add ponto editor helpers"
```

---

### Task 3: IPC Path for Manual Conversion

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/renderer/types/electron.d.ts`

- [x] **Step 1: Add preload API**

In `src/preload/index.ts`, add this method to `pontoAPI` after `processExcel`:

```ts
buildPontoData: (input: unknown): Promise<unknown> =>
  ipcRenderer.invoke('build-ponto-data', input),
```

- [x] **Step 2: Add renderer API typing**

In `src/renderer/types/electron.d.ts`, add:

```ts
export interface BuildPontoDataResult {
  success: boolean
  data?: unknown
  error?: string
  errors?: Array<{ dia: number; campo: string; mensagem: string }>
}
```

Add this method to `PontoAPI` after `processExcel`:

```ts
buildPontoData: (input: {
  header: PontoHeader
  records: ManualPontoRecordInput[]
}) => Promise<BuildPontoDataResult>
```

- [x] **Step 3: Register IPC handler**

In `src/main/ipc/handlers.ts`, import the service:

```ts
import { buildPontoDataFromManualInput } from '../../../backend/services/buildPontoDataFromManualInput'
```

Add this handler after `process-excel`:

```ts
ipcMain.handle('build-ponto-data', async (_event, input: { header: PontoHeader; records: unknown }) => {
  if (!input || !input.header || !Array.isArray(input.records)) {
    return { success: false, error: 'Dados invalidos para montagem da folha de ponto' }
  }

  try {
    return buildPontoDataFromManualInput(
      input.header,
      input.records as import('../../../backend/types/ponto').ManualPontoRecordInput[],
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Erro ao montar folha de ponto: ${msg}` }
  }
})
```

- [x] **Step 4: Run focused tests**

Run: `pnpm test backend/services/buildPontoDataFromManualInput.test.ts src/renderer/components/pontoEditor.test.ts`

Expected: PASS.

- [x] **Step 5: Commit IPC bridge**

```bash
git add src/preload/index.ts src/main/ipc/handlers.ts src/renderer/types/electron.d.ts
git commit -m "feat: expose manual ponto data builder"
```

---

### Task 4: PontoTab In-App Editor UI

**Files:**
- Modify: `src/renderer/components/PontoTab.tsx`
- Modify: `src/renderer/components/PontoTab.test.tsx`

- [x] **Step 1: Extend operation state**

In `src/renderer/components/PontoTab.tsx`, change:

```ts
type Operacao = 'planilha' | 'excel' | 'pdf'
```

to:

```ts
type Operacao = 'planilha' | 'excel' | 'pdf' | 'validacao'
```

- [x] **Step 2: Import editor helpers and result type**

Update imports:

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
import {
  applyDefaultSchedule,
  createMonthlyRows,
  serializeRowsForManualInput,
  toggleFolga,
  updateRowTime,
  type PontoEditorRow,
} from './pontoEditor'
```

- [x] **Step 3: Add editor state**

Inside `PontoTab`, add:

```ts
const [rows, setRows] = useState<PontoEditorRow[]>(() =>
  createMonthlyRows(mes, ANO_ATUAL),
)
const [manualData, setManualData] = useState<unknown>(null)
```

Add this effect after the employee reset effect:

```ts
useEffect(() => {
  setRows(createMonthlyRows(mes, ANO_ATUAL))
  setManualData(null)
  setExcelData(null)
}, [mes, selectedEmployeeId, selectedOrganizationId])
```

- [x] **Step 4: Add manual PDF action**

Add this function before `handleGerarPlanilha`:

```ts
async function handleGerarPdfDireto(): Promise<void> {
  if (!selectedOrganization || !selectedEmployee) return
  setStatus({ tipo: 'loading', operacao: 'validacao' })

  const header: PontoHeader = {
    empresa: selectedOrganization.nome,
    nome: selectedEmployee.nome,
    secao: selectedEmployee.setor,
    mes,
    ano: ANO_ATUAL,
  }

  try {
    const buildResult = (await window.pontoAPI.buildPontoData({
      header,
      records: serializeRowsForManualInput(rows),
    })) as BuildPontoDataResult

    if (!buildResult.success) {
      const lista = buildResult.errors?.map((error) => error.mensagem)
      setStatus({
        tipo: 'erro',
        operacao: 'validacao',
        mensagem:
          lista && lista.length > 0
            ? `${lista.length} erro(s) encontrado(s) na grade`
            : (buildResult.error ?? 'Nao foi possivel validar a grade.'),
        lista,
      })
      return
    }

    setManualData(buildResult.data)
    setStatus({ tipo: 'loading', operacao: 'pdf' })

    const pdfResult = (await window.pontoAPI.generatePdf({
      data: buildResult.data,
      logoPath: selectedOrganization.logoPath,
    })) as PdfResult

    if (pdfResult.canceled) {
      setStatus({ tipo: 'idle' })
      return
    }
    if (!pdfResult.success) {
      setStatus({
        tipo: 'erro',
        operacao: 'pdf',
        mensagem: pdfResult.error ?? 'Nao foi possivel gerar o PDF.',
      })
      return
    }

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
```

- [x] **Step 5: Add editor controls to JSX**

Replace the current stepper and button block with:

```tsx
<div style={s.editorActions}>
  <button
    type='button'
    onClick={() =>
      setRows((current) =>
        applyDefaultSchedule(current, {
          entrada: '08:00',
          inicioIntervalo: '12:00',
          fimIntervalo: '13:00',
          saida: '17:00',
        }),
      )
    }
    disabled={!selectedEmployee || isLoading}
    style={{ ...s.botao, ...s.botaoAzul }}
  >
    Aplicar horário padrão
  </button>

  <button
    type='button'
    onClick={handleGerarPdfDireto}
    disabled={!selectedOrganization || !selectedEmployee || isLoading}
    style={{
      ...s.botao,
      ...s.botaoLaranja,
      ...(!selectedOrganization || !selectedEmployee || isLoading
        ? s.botaoDesabilitado
        : {}),
    }}
  >
    {isLoading && (status.operacao === 'validacao' || status.operacao === 'pdf') ? (
      <>
        <span className='spinner' />
        Gerando PDF…
      </>
    ) : (
      'Gerar PDF'
    )}
  </button>
</div>

<div style={s.editorGrid}>
  <div style={s.editorHeader}>Dia</div>
  <div style={s.editorHeader}>Semana</div>
  <div style={s.editorHeader}>Entrada</div>
  <div style={s.editorHeader}>Início Intervalo</div>
  <div style={s.editorHeader}>Fim Intervalo</div>
  <div style={s.editorHeader}>Saída</div>
  <div style={s.editorHeader}>Folga</div>
  {rows.map((row) => (
    <div key={row.dia} style={s.editorRow}>
      <span>{row.dia}</span>
      <span>{row.diaSemana}</span>
      {(['entrada', 'inicioIntervalo', 'fimIntervalo', 'saida'] as const).map((field) => (
        <input
          key={field}
          type='text'
          inputMode='numeric'
          placeholder={row.folga ? 'FOLGA' : 'HH:mm'}
          value={row.folga ? 'FOLGA' : row[field]}
          disabled={row.folga || !selectedEmployee || isLoading}
          onChange={(event) =>
            setRows((current) =>
              updateRowTime(current, row.dia, field, event.target.value),
            )
          }
          style={s.timeInput}
        />
      ))}
      <input
        type='checkbox'
        checked={row.folga}
        disabled={!selectedEmployee || isLoading}
        onChange={(event) =>
          setRows((current) => toggleFolga(current, row.dia, event.target.checked))
        }
      />
    </div>
  ))}
</div>

<details style={s.excelDetails}>
  <summary>Usar planilha Excel</summary>
  <div style={s.botoes}>
    <!-- keep existing Gerar Planilha, Selecionar Excel, and Gerar PDF buttons here -->
  </div>
</details>
```

When moving the existing Excel buttons inside the `<details>`, keep their existing handlers unchanged.

- [x] **Step 6: Add styles**

Add these keys to the `s` object:

```ts
editorActions: {
  display: 'flex',
  gap: 12,
  justifyContent: 'flex-end',
  marginTop: 18,
  marginBottom: 14,
  flexWrap: 'wrap',
},
editorGrid: {
  display: 'grid',
  gap: 6,
  marginTop: 8,
  overflowX: 'auto',
},
editorHeader: {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#334155',
},
editorRow: {
  display: 'grid',
  gridTemplateColumns: '44px 92px repeat(4, minmax(88px, 1fr)) 60px',
  gap: 6,
  alignItems: 'center',
},
timeInput: {
  minHeight: 36,
  border: '1px solid #d7dde8',
  borderRadius: 6,
  padding: '0 8px',
  fontSize: '0.9rem',
},
excelDetails: {
  marginTop: 20,
  borderTop: '1px solid #e2e8f0',
  paddingTop: 14,
},
```

- [x] **Step 7: Update status labels**

In all status label maps, add:

```ts
validacao: 'Validando grade…'
```

For error titles, add:

```ts
validacao: 'Erro ao validar grade'
```

- [x] **Step 8: Update static render test**

In `src/renderer/components/PontoTab.test.tsx`, add:

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

- [x] **Step 9: Run renderer tests**

Run: `pnpm test src/renderer/components/PontoTab.test.tsx src/renderer/components/pontoEditor.test.ts`

Expected: PASS.

- [x] **Step 10: Commit UI**

```bash
git add src/renderer/components/PontoTab.tsx src/renderer/components/PontoTab.test.tsx
git commit -m "feat: add in-app ponto editor"
```

---

### Task 5: Final Verification

**Files:**
- Review: all changed files

- [x] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: all tests pass.

- [x] **Step 2: Run production build**

Run: `pnpm build`

Expected: Electron Vite build completes successfully.

- [ ] **Step 3: Manual smoke test**

Not executed in this run because it requires launching the Electron UI and interacting with native save dialogs.

Run: `pnpm dev`

Expected manual behavior:

- Select an organization and employee.
- Apply default schedule.
- Mark one day as folga.
- Click Gerar PDF.
- Confirm the generated PDF opens and contains `FOLGA` for the selected day.
- Expand "Usar planilha Excel" and confirm the legacy buttons are still visible.

- [ ] **Step 4: Commit final polish if needed**

Not needed in this run. Automated verification passed without follow-up fixes.

If verification requires small fixes:

```bash
git add <fixed-files>
git commit -m "fix: polish in-app ponto editor"
```

---

## Self-Review

- Spec coverage: The plan covers backend data conversion, renderer monthly editor helpers, IPC bridge, UI integration, Excel compatibility, and verification.
- Placeholder scan: No placeholder markers remain.
- Type consistency: `ManualPontoRecordInput`, `BuildPontoDataResult`, and `PontoEditorRow` are introduced before use in later tasks.
