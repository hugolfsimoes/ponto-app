# Remover Feature de Excel

## Contexto

O app hoje tem dois caminhos para gerar a folha de ponto em PDF: o editor manual (grade preenchida direto na tela) e um fluxo de Excel (gerar planilha em branco, o usuario preenche fora do app, reimporta, e so entao gera o PDF). O editor manual ja cobre o mesmo resultado sem sair do app, e o fluxo Excel nao e mais usado pelos usuarios hoje.

## Objetivo

Remover completamente o fluxo de Excel (geracao de template e importacao/parsing), mantendo apenas o editor manual como caminho para gerar o PDF.

## Fora de Escopo

- Qualquer flag ou modo de compatibilidade temporario. A remocao e definitiva; o codigo fica recuperavel via historico do git se for necessario no futuro.
- Mudancas no layout ou logica do PDF gerado (`generatePdf.ts` nao muda).
- Mudancas na logica de calculo de horas, validacao do editor manual, ou persistencia de cadastros.

## Design Recomendado

### Arquivos removidos por completo

- `backend/services/generateTemplate.ts` e `backend/services/generateTemplate.test.ts`
- `backend/services/processExcel.ts` (nao tem teste dedicado hoje)
- `backend/validators/excelValidator.ts` e `backend/validators/excelValidator.test.ts`

Nenhum outro arquivo do app depende desses tres servicos.

### Arquivos modificados

- `backend/utils/timeUtils.ts` e `backend/utils/timeUtils.test.ts`: remove a funcao `parseExcelTime` e o helper `createValidationError` (usado somente por ela). As demais funcoes do arquivo (`toMinutes`, `normalizeSequentialMinutes`, `formatMinutes`, a constante `MINUTES_IN_DAY`) continuam, pois sao usadas por `calculateHours.ts` e `groupByWeek.ts`.
- `src/main/ipc/handlers.ts`: remove os handlers IPC `generate-template` e `process-excel`, e os imports (`generateTemplate`, `validateHeader`, `suggestFileName`, `processExcel`) que ficam sem uso. O handler `generate-pdf` e suas funcoes auxiliares de logo (`loadLogo`, `loadLogoFromPath`) continuam, pois sao usadas pela geracao de PDF.
- `src/preload/index.ts`: remove os metodos `generateTemplate` e `processExcel` da ponte `pontoAPI`.
- `src/renderer/types/electron.d.ts`: remove os tipos `TemplateResult` e `ProcessResult`, e as assinaturas `generateTemplate`/`processExcel` de `PontoAPI`.
- `src/renderer/components/PontoTab.tsx`:
  - Remove o estado `excelData` e os derivados `podeGerarPlanilha`/`podeGerarPdf`.
  - Remove os handlers `handleGerarPlanilha`, `handleSelecionarExcel`, e a versao de `handleGerarPdf` que usa `excelData` (a versao usada pelo editor manual, `handleGerarPdfDireto`, permanece sem mudancas).
  - Remove a secao `<details>` "Usar planilha Excel" inteira (os tres botoes numerados) e o badge "Planilha carregada — pronta para gerar PDF".
  - Reduz o tipo `Operacao` de `'planilha' | 'excel' | 'pdf' | 'validacao'` para `'pdf' | 'validacao'`, e remove as entradas `planilha`/`excel` dos dicionarios de mensagem de loading/sucesso/erro.
  - Remove o estado `doneOps`/`setDoneOps` e a funcao `markDone` — hoje esse estado e escrito mas nunca lido em lugar nenhum da tela, e duas das tres chamadas (`markDone('planilha')`, `markDone('excel')`) desaparecem com a remocao do Excel, deixando o que sobra ainda mais orfao.
  - Remove os objetos de estilo que ficam sem uso: `steps`, `stepLine`, `divider` (ja nao usados hoje), e `excelDetails`, `excelSummary`, `botoes`, `badgeExcel` (usados somente pela secao removida).
  - Remove os imports `ProcessResult`/`TemplateResult` que ficam sem uso.
- `src/renderer/components/PontoTab.test.tsx`: remove a asserção `expect(html).toContain('Usar planilha Excel')` do teste "renders the in-app editor actions".
- `package.json`: remove as dependencias `xlsx` e `exceljs` (usadas somente pelos arquivos removidos).

### Testes

Nenhum teste novo e necessario alem dos ajustes acima — a remocao e puramente subtrativa. Os testes existentes de `calculateHours`, `buildPontoDataFromManualInput`, `pontoEditor`, `generatePdf` e `localDataStore`/`backupStore` continuam cobrindo o fluxo que permanece (editor manual → PDF) sem alteracao.

## Criterios de Aceite

- Nao existe mais nenhuma referencia a `generateTemplate`, `processExcel`, `excelValidator`, `parseExcelTime`, `TemplateResult` ou `ProcessResult` no codigo.
- A aba Ponto nao mostra mais nenhum botao ou secao relacionada a Excel.
- O fluxo editor manual → "Gerar PDF" continua funcionando exatamente como hoje (mesmos campos, mesmo seletor de tamanho de fonte, mesmos checkboxes de Folga/Feriado).
- `xlsx` e `exceljs` nao aparecem mais em `package.json`.
- `pnpm test` e `pnpm build` passam.
