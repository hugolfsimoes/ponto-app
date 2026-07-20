# Tamanho de Fonte dos Horarios no PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick the font size (7-12pt, default 10) used for the four horario columns (Entrada, Inicio Intervalo, Fim Intervalo, Saida) when generating the ponto PDF, in both the manual-editor and Excel-import flows.

**Architecture:** Thread an optional `horarioFontSize` value from a new `PontoTab` dropdown, through the existing `generatePdf` IPC call, into `generatePdf()`'s table-building logic. No persistence; the value only affects the current PDF generation.

**Tech Stack:** Electron, React, TypeScript, Vitest, pdfmake (`backend/services/generatePdf.ts`).

## Global Constraints

- Font size options are restricted to integers 7-12; default is 10.
- Only the four horario columns (Entrada, Inicio Intervalo, Fim Intervalo, Saida) are affected. Dia, Dia da Semana, headers, Total Semana, Assinatura, and Justificativa keep their current fixed sizes.
- No new persistence (no DB, no organization/employee field). The chosen value lives only in component state for the current PDF generation.
- `pnpm test` and `pnpm build` must pass after every task.

---

## File Structure

- Modify `backend/services/generatePdf.ts`: `generatePdf()` accepts an optional third `options` argument with `horarioFontSize`; `buildTableBody()` uses it for the four horario cells.
- Modify `backend/services/generatePdf.test.ts`: add coverage for custom and default `horarioFontSize`.
- Modify `src/main/ipc/handlers.ts`: `generate-pdf` handler reads `horarioFontSize` from the IPC input and forwards it to `generatePdf()`.
- Modify `src/renderer/types/electron.d.ts`: `PontoAPI.generatePdf` input type gains optional `horarioFontSize?: number`.
- Modify `src/renderer/components/PontoTab.tsx`: add `horarioFontSize` state, a font-size `<select>` in the campos grid, and pass the value in both `generatePdf` calls.
- Modify `src/renderer/components/PontoTab.test.tsx`: static-render coverage confirming the selector renders with the default option.

---

### Task 1: Backend — configurable horario font size in `generatePdf`

**Files:**
- Modify: `backend/services/generatePdf.ts`
- Modify: `backend/services/generatePdf.test.ts`

**Interfaces:**
- Produces: `generatePdf(data: PontoData, logoBuffer?: Buffer, options?: { horarioFontSize?: number }): Promise<Buffer>` — the `options` param is new; existing two-argument calls keep working unchanged (`options` defaults to `undefined`, and inside the function `options?.horarioFontSize ?? 10` supplies the default).

- [ ] **Step 1: Write failing test for custom font size**

Add to `backend/services/generatePdf.test.ts` (inside the existing `describe('generatePdf layout', ...)` block, as a new `it`):

```ts
  it('applies a custom horarioFontSize to the time columns only', () => {
    const source = readFileSync(join(process.cwd(), 'backend/services/generatePdf.ts'), 'utf-8')

    expect(source).toMatch(/options\?\.horarioFontSize\s*\?\?\s*10/)
    expect(source).toMatch(/options\?:\s*\{\s*horarioFontSize\?:\s*number\s*\}/)
  })
```

This repo's existing `generatePdf.test.ts` tests assert against the raw source text (no PDF rendering/parsing helper exists), so this test follows the same pattern as the other three tests already in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test generatePdf.test.ts`
Expected: FAIL — the new `it` fails because `generatePdf.ts` does not yet contain `options?.horarioFontSize ?? 10` or the `options?: { horarioFontSize?: number }` parameter type.

- [ ] **Step 3: Add the `options` parameter and thread it into the table cells**

In `backend/services/generatePdf.ts`, change the `buildTableBody` signature (around line 90) from:

```ts
function buildTableBody(data: PontoData): TableCell[][] {
```

to:

```ts
function buildTableBody(
  data: PontoData,
  options?: { horarioFontSize?: number },
): TableCell[][] {
  const horarioFontSize = options?.horarioFontSize ?? 10;
```

Then update the four horario cells (around lines 116-119) from the hardcoded `fontSize: 10` to use the new variable:

```ts
      tc(String(rec.dia)),
      tc(rec.diaSemana),
      tc(folga ? 'FOLGA' : fmtTime(rec.entrada), { bold: folga, fontSize: horarioFontSize }),
      tc(folga ? 'FOLGA' : fmtTime(rec.inicioIntervalo), { bold: folga, fontSize: horarioFontSize }),
      tc(folga ? 'FOLGA' : fmtTime(rec.fimIntervalo), { bold: folga, fontSize: horarioFontSize }),
      tc(folga ? 'FOLGA' : fmtTime(rec.saida), { bold: folga, fontSize: horarioFontSize }),
```

Then update `generatePdf`'s own signature (around line 195) from:

```ts
export async function generatePdf(
  data: PontoData,
  logoBuffer?: Buffer
): Promise<Buffer> {
```

to:

```ts
export async function generatePdf(
  data: PontoData,
  logoBuffer?: Buffer,
  options?: { horarioFontSize?: number },
): Promise<Buffer> {
```

And update the call to `buildTableBody(data)` inside the table content block (around line 245) to:

```ts
          body: buildTableBody(data, options),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test generatePdf.test.ts`
Expected: PASS (4 tests total in that file).

- [ ] **Step 5: Commit**

```bash
git add backend/services/generatePdf.ts backend/services/generatePdf.test.ts
git commit -m "feat: accept configurable horario font size in generatePdf"
```

---

### Task 2: Wire `horarioFontSize` through the IPC handler and renderer types

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/renderer/types/electron.d.ts`

**Interfaces:**
- Consumes: `generatePdf(data, logoBuffer, options)` from Task 1.
- Produces: `PontoAPI.generatePdf` input type `{ data: unknown; logoPath?: string; horarioFontSize?: number }`, used by Task 3's `PontoTab.tsx` calls.

- [ ] **Step 1: Extend the renderer-facing type**

In `src/renderer/types/electron.d.ts`, change (around line 110):

```ts
  generatePdf: (input: { data: unknown; logoPath?: string }) => Promise<PdfResult>
```

to:

```ts
  generatePdf: (input: {
    data: unknown
    logoPath?: string
    horarioFontSize?: number
  }) => Promise<PdfResult>
```

- [ ] **Step 2: Read and forward `horarioFontSize` in the IPC handler**

In `src/main/ipc/handlers.ts`, change the `generate-pdf` handler signature and body (around lines 161-171) from:

```ts
  ipcMain.handle('generate-pdf', async (event, input: PontoData | { data: PontoData; logoPath?: string }) => {
    const data = 'data' in input ? input.data : input
    const logoPath = 'data' in input ? input.logoPath : undefined
    if (!data || !data.header || !data.records) {
      return { success: false, error: 'Dados inválidos para geração do PDF' }
    }

    let buffer: Buffer
    try {
      const logoBuffer = await loadLogoFromPath(logoPath)
      buffer = await generatePdf(data, logoBuffer)
    } catch (err) {
```

to:

```ts
  ipcMain.handle('generate-pdf', async (event, input: PontoData | { data: PontoData; logoPath?: string; horarioFontSize?: number }) => {
    const data = 'data' in input ? input.data : input
    const logoPath = 'data' in input ? input.logoPath : undefined
    const horarioFontSize = 'data' in input ? input.horarioFontSize : undefined
    if (!data || !data.header || !data.records) {
      return { success: false, error: 'Dados inválidos para geração do PDF' }
    }

    let buffer: Buffer
    try {
      const logoBuffer = await loadLogoFromPath(logoPath)
      buffer = await generatePdf(data, logoBuffer, { horarioFontSize })
    } catch (err) {
```

- [ ] **Step 3: Verify the project still builds**

Run: `pnpm build`
Expected: build succeeds with no TypeScript errors (this confirms the updated `PontoAPI` and handler types line up; there is no dedicated test file for `handlers.ts` in this repo, so a successful typecheck/build is the verification for this task).

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/handlers.ts src/renderer/types/electron.d.ts
git commit -m "feat: forward horarioFontSize through the generate-pdf IPC handler"
```

---

### Task 3: Font-size selector in `PontoTab`

**Files:**
- Modify: `src/renderer/components/PontoTab.tsx`
- Modify: `src/renderer/components/PontoTab.test.tsx`

**Interfaces:**
- Consumes: `window.pontoAPI.generatePdf(input)` where `input` now accepts `horarioFontSize?: number` (Task 2).

- [ ] **Step 1: Write the failing static-render test**

Add to `src/renderer/components/PontoTab.test.tsx` (new `it` inside the existing `describe('PontoTab', ...)` block):

```ts
  it('renders the horario font size selector with a default of 10', () => {
    const html = renderToStaticMarkup(
      <PontoTab organizations={[organization]} employees={[employee]} />,
    )

    expect(html).toContain('Tamanho da fonte dos horários')
    expect(html).toContain('value="10"')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test PontoTab.test.tsx`
Expected: FAIL — `'Tamanho da fonte dos horários'` is not yet present in the rendered output.

- [ ] **Step 3: Add font size options constant and state**

In `src/renderer/components/PontoTab.tsx`, add this constant near `MESES` (after line 36):

```ts
const HORARIO_FONT_SIZE_OPTIONS = [7, 8, 9, 10, 11, 12]
const DEFAULT_HORARIO_FONT_SIZE = 10
```

Add the state declaration next to the other `useState` calls (after line 77, `const [mes, setMes] = useState(...)`):

```ts
  const [horarioFontSize, setHorarioFontSize] = useState(DEFAULT_HORARIO_FONT_SIZE)
```

- [ ] **Step 4: Add the selector to the campos grid**

In the JSX, after the "Mês" `<div style={s.campo}>...</div>` block (ends around line 415, right before the closing `</div>` of `s.campos`), add a new field:

```tsx
        <div style={s.campo}>
          <label htmlFor='horarioFontSize' style={s.label}>
            Tamanho da fonte dos horários
          </label>
          <select
            id='horarioFontSize'
            value={horarioFontSize}
            onChange={(e) => setHorarioFontSize(Number(e.target.value))}
            disabled={isLoading}
            style={s.select}
          >
            {HORARIO_FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}pt
              </option>
            ))}
          </select>
        </div>
```

- [ ] **Step 5: Pass `horarioFontSize` in both `generatePdf` calls**

In `handleGerarPdfDireto` (around line 168-171), change:

```ts
      const pdfResult = (await window.pontoAPI.generatePdf({
        data: buildResult.data,
        logoPath: selectedOrganization.logoPath,
      })) as PdfResult
```

to:

```ts
      const pdfResult = (await window.pontoAPI.generatePdf({
        data: buildResult.data,
        logoPath: selectedOrganization.logoPath,
        horarioFontSize,
      })) as PdfResult
```

In `handleGerarPdf` (around line 288-291), change:

```ts
      const resultado = (await window.pontoAPI.generatePdf({
        data: excelData,
        logoPath: selectedOrganization?.logoPath,
      })) as PdfResult
```

to:

```ts
      const resultado = (await window.pontoAPI.generatePdf({
        data: excelData,
        logoPath: selectedOrganization?.logoPath,
        horarioFontSize,
      })) as PdfResult
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test PontoTab.test.tsx`
Expected: PASS (all `PontoTab` tests, including the new one).

- [ ] **Step 7: Run the full test suite and build**

Run: `pnpm test && pnpm build`
Expected: All tests pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/PontoTab.tsx src/renderer/components/PontoTab.test.tsx
git commit -m "feat: let the user choose the horario font size before generating the PDF"
```

---

## Acceptance Criteria Recap

- [ ] User sees and uses the font-size selector (7-12pt, default 10) before generating the PDF, in both the manual editor and Excel flows.
- [ ] Generated PDF reflects the chosen size only in the four horario columns.
- [ ] Leaving the default selected produces a PDF with 10pt horarios, matching current behavior.
- [ ] Other columns and PDF styles are unchanged.
- [ ] `pnpm test` and `pnpm build` pass.
