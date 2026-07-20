# Suporte a Feriado (Tipo de Dia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `folga: boolean` field with a single `tipoDia: 'NORMAL' | 'FOLGA' | 'FERIADO'` field throughout the app, so a day can be marked as FOLGA or FERIADO (mutually exclusive), in both the manual editor and Excel import, with the correct label printed on the generated PDF.

**Architecture:** Task 1 renames the field and threads the new `FERIADO` value through every backend file that already handles `folga` today (types, hours calculation, validation, manual-input builder, Excel import, PDF generation) — all backend files share one TypeScript project (`tsconfig.node.json`), so they must change together for the build to stay green. Task 2 does the equivalent rename plus the two-checkbox UI in the renderer, which is a separate TypeScript project (`tsconfig.web.json`) with its own mirrored types, so it can land independently.

**Tech Stack:** TypeScript, Vitest, Electron/React (renderer), pdfmake (PDF), `xlsx` (Excel import).

## Global Constraints

- `tipoDia` is a single field with exactly three values: `'NORMAL' | 'FOLGA' | 'FERIADO'`. There is no separate boolean for feriado — Folga and Feriado are mutually exclusive by construction (one field can't hold two values).
- Feriado behaves exactly like Folga for hours calculation (counts 0 minutes) and required-field validation (the 4 time fields are not required).
- In the Excel import, users type `FOLGA` or `FERIADO` (case-insensitive) into the 4 time cells of a day. Mixing any of {real horário, FOLGA, FERIADO} within the same day's 4 cells is a validation error — all 4 cells must be the same kind.
- The generated PDF prints the literal text `FOLGA` or `FERIADO` in bold in the day's 4 time columns, matching the current FOLGA styling.
- No changes to `generateTemplate.ts` (the generated Excel template) — users type the special value manually, exactly as they already do for FOLGA today.
- No new test file for `processExcel.ts` — no such file exists today for FOLGA either; this task does not add one.
- `pnpm test` and `pnpm build` must pass after every task.

---

## File Structure

- Modify `backend/types/ponto.ts`: add `TipoDia` type; replace `folga: boolean` with `tipoDia: TipoDia` in `PontoRecord` and `ManualPontoRecordInput`.
- Modify `backend/services/calculateHours.ts` (+ `.test.ts`): treat any non-`'NORMAL'` day as 0 minutes.
- Modify `backend/validators/excelValidator.ts` (+ `.test.ts`): skip required-field checks for any non-`'NORMAL'` day.
- Modify `backend/services/buildPontoDataFromManualInput.ts` (+ `.test.ts`): null out time fields and skip validation for non-`'NORMAL'` rows.
- Modify `backend/services/processExcel.ts`: recognize `FERIADO` alongside `FOLGA` in the 4 time cells, with the same all-or-nothing rule extended to cover mixing FOLGA and FERIADO.
- Modify `backend/services/generatePdf.ts`: print `rec.tipoDia` as the cell label whenever it isn't `'NORMAL'`.
- Modify `src/renderer/types/electron.d.ts`: mirror `TipoDia` and the `tipoDia` field on `ManualPontoRecordInput`.
- Modify `src/renderer/components/pontoEditor.ts` (+ `.test.ts`): `PontoEditorRow.tipoDia` replaces `folga`; `toggleFolga`/new `toggleFeriado` set/clear `tipoDia`; `updateRowTime`, `applyDefaultSchedule`, `serializeRowsForManualInput` updated for the renamed field.
- Modify `src/renderer/components/PontoTab.tsx` (+ `.test.tsx`): two checkboxes ("Folga", "Feriado") per row instead of one.

---

### Task 1: Backend — `tipoDia` replaces `folga`, with FERIADO support

**Files:**
- Modify: `backend/types/ponto.ts`
- Modify: `backend/services/calculateHours.ts`
- Modify: `backend/services/calculateHours.test.ts`
- Modify: `backend/validators/excelValidator.ts`
- Modify: `backend/validators/excelValidator.test.ts`
- Modify: `backend/services/buildPontoDataFromManualInput.ts`
- Modify: `backend/services/buildPontoDataFromManualInput.test.ts`
- Modify: `backend/services/processExcel.ts`
- Modify: `backend/services/generatePdf.ts`

**Interfaces:**
- Produces: `TipoDia = 'NORMAL' | 'FOLGA' | 'FERIADO'`, exported from `backend/types/ponto.ts`; `PontoRecord.tipoDia: TipoDia` and `ManualPontoRecordInput.tipoDia: TipoDia` replace their `folga: boolean` fields. Every backend file in this task consumes this same type — there is no intermediate state where only some of these files are updated, since `tsconfig.node.json` type-checks all of `backend/**` as one unit.

- [ ] **Step 1: Update the shared types**

In `backend/types/ponto.ts`, replace:

```ts
export interface PontoRecord {
  dia: number;
  diaSemana: DiaSemana;
  entrada: TimeEntry | null;
  inicioIntervalo: TimeEntry | null;
  fimIntervalo: TimeEntry | null;
  saida: TimeEntry | null;
  folga: boolean;
  minutesTrabalhados?: number;
}

export interface ManualPontoRecordInput {
  dia: number;
  entrada: TimeEntry | null;
  inicioIntervalo: TimeEntry | null;
  fimIntervalo: TimeEntry | null;
  saida: TimeEntry | null;
  folga: boolean;
}
```

with:

```ts
export type TipoDia = 'NORMAL' | 'FOLGA' | 'FERIADO';

export interface PontoRecord {
  dia: number;
  diaSemana: DiaSemana;
  entrada: TimeEntry | null;
  inicioIntervalo: TimeEntry | null;
  fimIntervalo: TimeEntry | null;
  saida: TimeEntry | null;
  tipoDia: TipoDia;
  minutesTrabalhados?: number;
}

export interface ManualPontoRecordInput {
  dia: number;
  entrada: TimeEntry | null;
  inicioIntervalo: TimeEntry | null;
  fimIntervalo: TimeEntry | null;
  saida: TimeEntry | null;
  tipoDia: TipoDia;
}
```

At this point `pnpm build` will fail with type errors in every file listed below — that's expected until the remaining steps land.

- [ ] **Step 2: Update `calculateHours` and its test (TDD)**

In `backend/services/calculateHours.test.ts`, update the `record()` helper's default from `folga: false,` to `tipoDia: 'NORMAL',`. Update the existing test:

```ts
  it('returns zero for days off', () => {
    expect(calculateHours(record({ folga: true }))).toBe(0)
  })
```

to:

```ts
  it('returns zero for days off', () => {
    expect(calculateHours(record({ tipoDia: 'FOLGA' }))).toBe(0)
  })

  it('returns zero for feriado', () => {
    expect(calculateHours(record({ tipoDia: 'FERIADO' }))).toBe(0)
  })
```

Run: `npx vitest run backend/services/calculateHours.test.ts`
Expected: FAIL — `record()` no longer type-checks / `folga` doesn't exist yet on the implementation side (the file still reads `record.folga`).

In `backend/services/calculateHours.ts`, change:

```ts
export function calculateHours(record: PontoRecord): number {
  if (record.folga) return 0
```

to:

```ts
export function calculateHours(record: PontoRecord): number {
  if (record.tipoDia !== 'NORMAL') return 0
```

Also update the doc comment above it that says `está ausente quando folga === false.` to `está ausente quando tipoDia === 'NORMAL'.`

Run: `npx vitest run backend/services/calculateHours.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 3: Update `excelValidator` and its test (TDD)**

In `backend/validators/excelValidator.test.ts`, update the `record()` helper's default from `folga: false,` to `tipoDia: 'NORMAL',`. Add a new test:

```ts
  it('skips required-field validation for folga and feriado days', () => {
    const errors = validate([
      record({
        tipoDia: 'FOLGA',
        entrada: null,
        inicioIntervalo: null,
        fimIntervalo: null,
        saida: null,
      }),
      record({
        dia: 2,
        tipoDia: 'FERIADO',
        entrada: null,
        inicioIntervalo: null,
        fimIntervalo: null,
        saida: null,
      }),
    ])

    expect(errors).toEqual([])
  })
```

Run: `npx vitest run backend/validators/excelValidator.test.ts`
Expected: FAIL — `record()` references `tipoDia`, which the implementation doesn't check yet (still reads `record.folga`).

In `backend/validators/excelValidator.ts`, change:

```ts
    if (record.folga) continue
```

to:

```ts
    if (record.tipoDia !== 'NORMAL') continue
```

Run: `npx vitest run backend/validators/excelValidator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Update `buildPontoDataFromManualInput` and its test (TDD)**

In `backend/services/buildPontoDataFromManualInput.test.ts`, update the `workingDay()` helper's default from `folga: false,` to `tipoDia: 'NORMAL',`. Update the existing test:

```ts
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
```

to:

```ts
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
          tipoDia: 'FOLGA',
        },
      ]),
    )

    expect(result.success).toBe(true)
    expect(result.data?.records[2]).toMatchObject({
      dia: 3,
      tipoDia: 'FOLGA',
      minutesTrabalhados: 0,
    })
  })

  it('marks feriado days with zero minutes', () => {
    const result = buildPontoDataFromManualInput(
      header,
      fullMonth([
        {
          dia: 4,
          entrada: null,
          inicioIntervalo: null,
          fimIntervalo: null,
          saida: null,
          tipoDia: 'FERIADO',
        },
      ]),
    )

    expect(result.success).toBe(true)
    expect(result.data?.records[3]).toMatchObject({
      dia: 4,
      tipoDia: 'FERIADO',
      minutesTrabalhados: 0,
    })
  })
```

Run: `npx vitest run backend/services/buildPontoDataFromManualInput.test.ts`
Expected: FAIL — `fullMonth`/`workingDay` reference `tipoDia`, which the implementation doesn't produce yet (still reads/writes `row.folga`/`folga:`).

In `backend/services/buildPontoDataFromManualInput.ts`, change:

```ts
      const record: PontoRecord = {
        dia: row.dia,
        diaSemana: getDayName(row.dia, header.mes, header.ano),
        entrada: row.folga ? null : row.entrada,
        inicioIntervalo: row.folga ? null : row.inicioIntervalo,
        fimIntervalo: row.folga ? null : row.fimIntervalo,
        saida: row.folga ? null : row.saida,
        folga: row.folga,
      }
```

to:

```ts
      const record: PontoRecord = {
        dia: row.dia,
        diaSemana: getDayName(row.dia, header.mes, header.ano),
        entrada: row.tipoDia === 'NORMAL' ? row.entrada : null,
        inicioIntervalo: row.tipoDia === 'NORMAL' ? row.inicioIntervalo : null,
        fimIntervalo: row.tipoDia === 'NORMAL' ? row.fimIntervalo : null,
        saida: row.tipoDia === 'NORMAL' ? row.saida : null,
        tipoDia: row.tipoDia,
      }
```

And change:

```ts
    if (row.folga) continue
```

to:

```ts
    if (row.tipoDia !== 'NORMAL') continue
```

Run: `npx vitest run backend/services/buildPontoDataFromManualInput.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Add FERIADO recognition to `processExcel.ts`**

In `backend/services/processExcel.ts`, change:

```ts
const FOLGA_RE = /^folga$/i
```

to:

```ts
const FOLGA_RE = /^folga$/i
const FERIADO_RE = /^feriado$/i
```

Change the classification block:

```ts
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
```

to:

```ts
  type CelulaHorario = 'vazio' | 'folga' | 'feriado' | 'valor'
  const classificar = (raw: unknown): CelulaHorario => {
    if (raw === null || raw === undefined || raw === '') return 'vazio'
    if (typeof raw === 'string') {
      const t = raw.trim()
      if (t === '') return 'vazio'
      if (FOLGA_RE.test(t)) return 'folga'
      if (FERIADO_RE.test(t)) return 'feriado'
    }
    return 'valor'
  }

  const classes = slots.map((s) => classificar(s.raw))
  const nFolga = classes.filter((c) => c === 'folga').length
  const nFeriado = classes.filter((c) => c === 'feriado').length
  const nVazio = classes.filter((c) => c === 'vazio').length
  const nEspecial = nFolga + nFeriado
```

Change the `nVazio === 4` error message text (the two literal strings) from:

```ts
          `Dia ${dia}: preencha as quatro colunas (Entrada, intervalos e Saída) com horários ` +
          `ou escreva FOLGA nas quatro — não deixe células vazias.`,
```

to:

```ts
          `Dia ${dia}: preencha as quatro colunas (Entrada, intervalos e Saída) com horários ` +
          `ou escreva FOLGA ou FERIADO nas quatro — não deixe células vazias.`,
```

Change the `nVazio > 0` per-slot error message from:

```ts
        mensagem: `Dia ${dia}: campo '${slots[i].campo}' está vazio; use horário (HH:mm) ou FOLGA.`,
```

to:

```ts
        mensagem: `Dia ${dia}: campo '${slots[i].campo}' está vazio; use horário (HH:mm), FOLGA ou FERIADO.`,
```

Replace the mixed/all-folga handling block:

```ts
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
```

with:

```ts
  if (nEspecial > 0 && nEspecial < 4) {
    return {
      type: 'error',
      errors: [{
        dia,
        campo: 'FOLGA/FERIADO',
        mensagem:
          `Dia ${dia}: em dia de folga ou feriado, as quatro colunas de horário devem conter o mesmo valor. ` +
          `Não misture FOLGA, FERIADO e horários reais nem deixe só algumas colunas preenchidas.`,
      }],
    }
  }

  if (nEspecial === 4 && nFolga > 0 && nFeriado > 0) {
    return {
      type: 'error',
      errors: [{
        dia,
        campo: 'FOLGA/FERIADO',
        mensagem: `Dia ${dia}: não misture FOLGA e FERIADO no mesmo dia — use apenas um dos dois nas quatro colunas.`,
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
        tipoDia: 'FOLGA',
      },
      warnings,
    }
  }

  if (nFeriado === 4) {
    return {
      type: 'ok',
      record: {
        dia,
        diaSemana,
        entrada: null,
        inicioIntervalo: null,
        fimIntervalo: null,
        saida: null,
        tipoDia: 'FERIADO',
      },
      warnings,
    }
  }
```

Finally, in the "quatro horários reais" branch at the end of `parseRow`, change:

```ts
  return {
    type: 'ok',
    record: { dia, diaSemana, entrada, inicioIntervalo, fimIntervalo, saida, folga: false },
    warnings,
  }
```

to:

```ts
  return {
    type: 'ok',
    record: { dia, diaSemana, entrada, inicioIntervalo, fimIntervalo, saida, tipoDia: 'NORMAL' },
    warnings,
  }
```

There is no `processExcel.test.ts` to run for this file (none exists today, for FOLGA either) — verification for this step is the full-suite run and build in Step 7.

- [ ] **Step 6: Print FERIADO in the generated PDF**

In `backend/services/generatePdf.ts`, inside `buildTableBody`, change:

```ts
  const dataRows: TableCell[][] = data.records.map((rec: PontoRecord) => {
    const totalSemana = weekTotals.get(rec.dia) ?? '';
    const folga = rec.folga;

    return [
      tc(String(rec.dia), { fontSize: 10 }),
      tc(rec.diaSemana, { fontSize: 10 }),
      tc(folga ? 'FOLGA' : fmtTime(rec.entrada), { bold: folga, fontSize: horarioFontSize }),
      tc(folga ? 'FOLGA' : fmtTime(rec.inicioIntervalo), { bold: folga, fontSize: horarioFontSize }),
      tc(folga ? 'FOLGA' : fmtTime(rec.fimIntervalo), { bold: folga, fontSize: horarioFontSize }),
      tc(folga ? 'FOLGA' : fmtTime(rec.saida), { bold: folga, fontSize: horarioFontSize }),
      tc(totalSemana, { bold: !!totalSemana, fontSize: totalSemana ? 10 : FS }),
      tc(' ', { fontSize: 10 }), // Assinatura — espaço para preenchimento manual
      tc(''),                    // Justificativa — espaço para preenchimento manual
    ];
  });
```

to:

```ts
  const dataRows: TableCell[][] = data.records.map((rec: PontoRecord) => {
    const totalSemana = weekTotals.get(rec.dia) ?? '';
    const label = rec.tipoDia === 'NORMAL' ? null : rec.tipoDia;

    return [
      tc(String(rec.dia), { fontSize: 10 }),
      tc(rec.diaSemana, { fontSize: 10 }),
      tc(label ?? fmtTime(rec.entrada), { bold: !!label, fontSize: horarioFontSize }),
      tc(label ?? fmtTime(rec.inicioIntervalo), { bold: !!label, fontSize: horarioFontSize }),
      tc(label ?? fmtTime(rec.fimIntervalo), { bold: !!label, fontSize: horarioFontSize }),
      tc(label ?? fmtTime(rec.saida), { bold: !!label, fontSize: horarioFontSize }),
      tc(totalSemana, { bold: !!totalSemana, fontSize: totalSemana ? 10 : FS }),
      tc(' ', { fontSize: 10 }), // Assinatura — espaço para preenchimento manual
      tc(''),                    // Justificativa — espaço para preenchimento manual
    ];
  });
```

`rec.tipoDia` is already the exact string (`'FOLGA'` or `'FERIADO'`) to print, so no separate label-mapping table is needed. There is no folga/feriado-specific test in `generatePdf.test.ts` today — this step doesn't add one, per the plan's scope.

- [ ] **Step 7: Run the full backend test suite and build**

Run: `pnpm test`
Expected: All tests pass (existing count plus the 4 new cases added in Steps 2–4).

Run: `pnpm build`
Expected: Succeeds with no TypeScript errors (confirms `processExcel.ts` and `generatePdf.ts` compile against the renamed type, even without dedicated new tests for those two files).

- [ ] **Step 8: Commit**

```bash
git add backend/types/ponto.ts backend/services/calculateHours.ts backend/services/calculateHours.test.ts backend/validators/excelValidator.ts backend/validators/excelValidator.test.ts backend/services/buildPontoDataFromManualInput.ts backend/services/buildPontoDataFromManualInput.test.ts backend/services/processExcel.ts backend/services/generatePdf.ts
git commit -m "feat: replace folga boolean with tipoDia to support feriado"
```

---

### Task 2: Renderer — two checkboxes (Folga / Feriado) in the manual editor

**Files:**
- Modify: `src/renderer/types/electron.d.ts`
- Modify: `src/renderer/components/pontoEditor.ts`
- Modify: `src/renderer/components/pontoEditor.test.ts`
- Modify: `src/renderer/components/PontoTab.tsx`
- Modify: `src/renderer/components/PontoTab.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 directly — the renderer's `ManualPontoRecordInput` is a hand-mirrored type in `electron.d.ts`, not imported from `backend/types/ponto.ts` (confirmed existing pattern: the file's header comment states renderer types intentionally mirror backend types without importing them).
- Produces: `TipoDia` (renderer-local mirror), `PontoEditorRow.tipoDia: TipoDia`, `toggleFolga(rows, dia, checked): PontoEditorRow[]`, `toggleFeriado(rows, dia, checked): PontoEditorRow[]` — both exported from `pontoEditor.ts` and used by `PontoTab.tsx`.

- [ ] **Step 1: Mirror `TipoDia` in the renderer type**

In `src/renderer/types/electron.d.ts`, change:

```ts
export interface ManualPontoRecordInput {
  dia: number
  entrada: TimeEntry | null
  inicioIntervalo: TimeEntry | null
  fimIntervalo: TimeEntry | null
  saida: TimeEntry | null
  folga: boolean
}
```

to:

```ts
export type TipoDia = 'NORMAL' | 'FOLGA' | 'FERIADO'

export interface ManualPontoRecordInput {
  dia: number
  entrada: TimeEntry | null
  inicioIntervalo: TimeEntry | null
  fimIntervalo: TimeEntry | null
  saida: TimeEntry | null
  tipoDia: TipoDia
}
```

- [ ] **Step 2: Write failing tests for `pontoEditor.ts`**

In `src/renderer/components/pontoEditor.test.ts`, change the import line:

```ts
import {
  applyDefaultSchedule,
  createMonthlyRows,
  parseTimeInput,
  serializeRowsForManualInput,
  toggleFolga,
} from './pontoEditor'
```

to:

```ts
import {
  applyDefaultSchedule,
  createMonthlyRows,
  parseTimeInput,
  serializeRowsForManualInput,
  toggleFeriado,
  toggleFolga,
  updateRowTime,
} from './pontoEditor'
```

Update the first test's assertion from `folga: false,` to `tipoDia: 'NORMAL',`:

```ts
    expect(rows[0]).toMatchObject({
      dia: 1,
      diaSemana: 'DOMINGO',
      tipoDia: 'NORMAL',
    })
```

Update the "applies a default schedule" test's last assertion from `.folga` to `.tipoDia`:

```ts
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
    expect(result[1].tipoDia).toBe('FOLGA')
  })
```

Update the serialize test's expected object from `folga: false,` to `tipoDia: 'NORMAL',`:

```ts
    expect(serializeRowsForManualInput(rows)[0]).toEqual({
      dia: 1,
      entrada: { hora: 8, minuto: 0 },
      inicioIntervalo: { hora: 12, minuto: 0 },
      fimIntervalo: { hora: 13, minuto: 0 },
      saida: { hora: 17, minuto: 0 },
      tipoDia: 'NORMAL',
    })
```

Add three new tests at the end of the `describe` block:

```ts
  it('marks a day as feriado and clears its times', () => {
    const rows = toggleFeriado(createMonthlyRows(2, 2026), 5, true)
    expect(rows[4]).toMatchObject({ dia: 5, tipoDia: 'FERIADO', entrada: '' })
  })

  it('toggling feriado overrides a previous folga on the same day, and vice versa', () => {
    const folgaRows = toggleFolga(createMonthlyRows(2, 2026), 5, true)
    const feriadoRows = toggleFeriado(folgaRows, 5, true)
    expect(feriadoRows[4].tipoDia).toBe('FERIADO')

    const backToFolga = toggleFolga(feriadoRows, 5, true)
    expect(backToFolga[4].tipoDia).toBe('FOLGA')
  })

  it('updateRowTime resets the day back to normal', () => {
    const rows = toggleFeriado(createMonthlyRows(2, 2026), 5, true)
    const updated = updateRowTime(rows, 5, 'entrada', '08:00')
    expect(updated[4].tipoDia).toBe('NORMAL')
  })
```

Run: `npx vitest run src/renderer/components/pontoEditor.test.ts`
Expected: FAIL — `toggleFeriado` doesn't exist yet, and the existing assertions reference `tipoDia`, which the implementation doesn't produce yet.

- [ ] **Step 3: Implement `tipoDia` in `pontoEditor.ts`**

Change the import at the top from:

```ts
import type { ManualPontoRecordInput, TimeEntry } from '../types/electron'
```

to:

```ts
import type { ManualPontoRecordInput, TimeEntry, TipoDia } from '../types/electron'
```

Change `PontoEditorRow`:

```ts
export interface PontoEditorRow {
  dia: number
  diaSemana: string
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
  folga: boolean
}
```

to:

```ts
export interface PontoEditorRow {
  dia: number
  diaSemana: string
  entrada: string
  inicioIntervalo: string
  fimIntervalo: string
  saida: string
  tipoDia: TipoDia
}
```

In `createMonthlyRows`, change:

```ts
    return {
      dia,
      diaSemana: DIAS_SEMANA[weekDay],
      entrada: '',
      inicioIntervalo: '',
      fimIntervalo: '',
      saida: '',
      folga: false,
    }
```

to:

```ts
    return {
      dia,
      diaSemana: DIAS_SEMANA[weekDay],
      entrada: '',
      inicioIntervalo: '',
      fimIntervalo: '',
      saida: '',
      tipoDia: 'NORMAL',
    }
```

Replace `toggleFolga` with `toggleFolga`, `toggleFeriado`, and a shared `setTipoDia` helper:

```ts
export function toggleFolga(
  rows: PontoEditorRow[],
  dia: number,
  checked: boolean,
): PontoEditorRow[] {
  return setTipoDia(rows, dia, checked ? 'FOLGA' : 'NORMAL')
}

export function toggleFeriado(
  rows: PontoEditorRow[],
  dia: number,
  checked: boolean,
): PontoEditorRow[] {
  return setTipoDia(rows, dia, checked ? 'FERIADO' : 'NORMAL')
}

function setTipoDia(
  rows: PontoEditorRow[],
  dia: number,
  tipoDia: TipoDia,
): PontoEditorRow[] {
  return rows.map((row) =>
    row.dia === dia
      ? {
          ...row,
          tipoDia,
          entrada: tipoDia === 'NORMAL' ? row.entrada : '',
          inicioIntervalo: tipoDia === 'NORMAL' ? row.inicioIntervalo : '',
          fimIntervalo: tipoDia === 'NORMAL' ? row.fimIntervalo : '',
          saida: tipoDia === 'NORMAL' ? row.saida : '',
        }
      : row,
  )
}
```

In `updateRowTime`, change:

```ts
  return rows.map((row) =>
    row.dia === dia ? { ...row, [field]: value, folga: false } : row,
  )
```

to:

```ts
  return rows.map((row) =>
    row.dia === dia ? { ...row, [field]: value, tipoDia: 'NORMAL' } : row,
  )
```

In `applyDefaultSchedule`, change:

```ts
  return rows.map((row) => (row.folga ? row : { ...row, ...schedule }))
```

to:

```ts
  return rows.map((row) => (row.tipoDia === 'NORMAL' ? { ...row, ...schedule } : row))
```

In `serializeRowsForManualInput`, change:

```ts
  return rows.map((row) => ({
    dia: row.dia,
    entrada: row.folga ? null : parseTimeInput(row.entrada),
    inicioIntervalo: row.folga ? null : parseTimeInput(row.inicioIntervalo),
    fimIntervalo: row.folga ? null : parseTimeInput(row.fimIntervalo),
    saida: row.folga ? null : parseTimeInput(row.saida),
    folga: row.folga,
  }))
```

to:

```ts
  return rows.map((row) => ({
    dia: row.dia,
    entrada: row.tipoDia === 'NORMAL' ? parseTimeInput(row.entrada) : null,
    inicioIntervalo: row.tipoDia === 'NORMAL' ? parseTimeInput(row.inicioIntervalo) : null,
    fimIntervalo: row.tipoDia === 'NORMAL' ? parseTimeInput(row.fimIntervalo) : null,
    saida: row.tipoDia === 'NORMAL' ? parseTimeInput(row.saida) : null,
    tipoDia: row.tipoDia,
  }))
```

Run: `npx vitest run src/renderer/components/pontoEditor.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 4: Write the failing UI test for the two checkboxes**

In `src/renderer/components/PontoTab.test.tsx`, add a new test inside the existing `describe('PontoTab', ...)` block (near the "renders the in-app editor actions" test):

```ts
  it('renders separate Folga and Feriado columns in the editor grid', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('<span>Folga</span>')
    expect(html).toContain('<span>Feriado</span>')
  })
```

Run: `npx vitest run src/renderer/components/PontoTab.test.tsx`
Expected: FAIL — there is no `<span>Feriado</span>` in the current markup (only a single "Folga" column).

- [ ] **Step 5: Add the Feriado checkbox and column to `PontoTab.tsx`**

Change the import from `./pontoEditor` (around line 11-19) to add `toggleFeriado`:

```ts
import {
  applyDefaultSchedule,
  createMonthlyRows,
  serializeRowsForManualInput,
  toggleFeriado,
  toggleFolga,
  updateRowTime,
  type PontoEditorRow,
  type DefaultSchedule,
} from './pontoEditor'
```

Change the grid header row:

```tsx
          <span>Dia</span>
          <span>Semana</span>
          <span>Entrada</span>
          <span>Início Intervalo</span>
          <span>Fim Intervalo</span>
          <span>Saída</span>
          <span>Folga</span>
        </div>
```

to:

```tsx
          <span>Dia</span>
          <span>Semana</span>
          <span>Entrada</span>
          <span>Início Intervalo</span>
          <span>Fim Intervalo</span>
          <span>Saída</span>
          <span>Folga</span>
          <span>Feriado</span>
        </div>
```

Change the time-input cells:

```tsx
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
```

to:

```tsx
                <input
                  key={field}
                  type='text'
                  inputMode='numeric'
                  placeholder={row.tipoDia !== 'NORMAL' ? row.tipoDia : 'HH:mm'}
                  value={row.tipoDia !== 'NORMAL' ? row.tipoDia : row[field]}
                  disabled={row.tipoDia !== 'NORMAL' || !selectedEmployee || isLoading}
                  onChange={(event) =>
                    setRows((current) =>
                      updateRowTime(current, row.dia, field, event.target.value),
                    )
                  }
                  style={s.timeInput}
                />
```

Change the single Folga checkbox:

```tsx
            <label style={s.folgaCell}>
              <input
                type='checkbox'
                checked={row.folga}
                disabled={!selectedEmployee || isLoading}
                onChange={(event) =>
                  setRows((current) =>
                    toggleFolga(current, row.dia, event.target.checked),
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>
```

to two checkboxes:

```tsx
            <label style={s.folgaCell}>
              <input
                type='checkbox'
                checked={row.tipoDia === 'FOLGA'}
                disabled={!selectedEmployee || isLoading}
                onChange={(event) =>
                  setRows((current) =>
                    toggleFolga(current, row.dia, event.target.checked),
                  )
                }
              />
            </label>
            <label style={s.folgaCell}>
              <input
                type='checkbox'
                checked={row.tipoDia === 'FERIADO'}
                disabled={!selectedEmployee || isLoading}
                onChange={(event) =>
                  setRows((current) =>
                    toggleFeriado(current, row.dia, event.target.checked),
                  )
                }
              />
            </label>
          </div>
        ))}
      </div>
```

Change the grid column templates (two occurrences, `editorHeaderRow` and `editorRow`) from:

```ts
    gridTemplateColumns: '44px 92px repeat(4, minmax(92px, 1fr)) 60px',
```

to:

```ts
    gridTemplateColumns: '44px 92px repeat(4, minmax(92px, 1fr)) 60px 60px',
```

And bump `minWidth: 620` to `minWidth: 680` in both `editorHeaderRow` and `editorRow` (an 8th 60px column needs more room than the original 7-column layout).

Run: `npx vitest run src/renderer/components/PontoTab.test.tsx`
Expected: PASS (all `PontoTab` tests, including the new one).

- [ ] **Step 6: Run the full test suite and build**

Run: `pnpm test && pnpm build`
Expected: All tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/types/electron.d.ts src/renderer/components/pontoEditor.ts src/renderer/components/pontoEditor.test.ts src/renderer/components/PontoTab.tsx src/renderer/components/PontoTab.test.tsx
git commit -m "feat: add separate Feriado checkbox alongside Folga in the manual editor"
```

---

## Acceptance Criteria Recap

- [ ] User can mark a day as Folga or Feriado in the manual editor, via two mutually-exclusive checkboxes.
- [ ] User can type FOLGA or FERIADO in the Excel import's time cells.
- [ ] Mixing FOLGA, FERIADO, and real times within the same day (in any combination) is a validation error.
- [ ] Folga and Feriado days count 0 minutes in daily/weekly/monthly totals.
- [ ] Generated PDF shows "FOLGA" or "FERIADO" in bold in the day's 4 time columns.
- [ ] All existing folga tests continue passing (renamed to use `tipoDia`); new feriado cases added to the 4 listed test files.
- [ ] `pnpm test` and `pnpm build` pass.
