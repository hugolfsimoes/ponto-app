# Tamanho de Fonte dos Horarios no PDF

## Contexto

Um cliente relatou que a fonte dos horarios (Entrada, Inicio Intervalo, Fim Intervalo, Saida) fica pequena demais na folha de ponto impressa. O PDF e gerado por `generatePdf.ts` (pdfmake) com uma constante fixa `FS = 7` usada em todas as celulas da tabela, sem opcao de ajuste.

Como primeiro passo, o tamanho dessas quatro colunas ja foi fixado em 10pt (`fontSize: 10` diretamente nas chamadas de `tc()` em `buildTableBody`). Esta spec cobre o passo seguinte: permitir que o usuario escolha o tamanho no momento de gerar o PDF, em vez de um valor fixo no codigo.

## Objetivo

Permitir que o usuario escolha o tamanho da fonte dos horarios (7 a 12pt, padrao 10) ao gerar o PDF da folha de ponto, nos dois fluxos existentes (editor manual e importacao via Excel).

## Fora de Escopo

- Persistir o tamanho escolhido como preferencia por organizacao ou funcionario.
- Tornar configuraveis outras fontes do documento (titulo, cabecalho, colunas Dia/Dia da Semana).
- Mudar largura de colunas ou layout geral da tabela.

## Fluxo do Usuario

1. Usuario abre a aba Ponto e preenche os dados (manualmente ou via Excel), como hoje.
2. Antes de clicar em "Gerar PDF", o usuario ve um seletor "Tamanho da fonte dos horarios" com opcoes de 7 a 12pt, comecando em 10.
3. Usuario clica em "Gerar PDF" (em qualquer um dos dois fluxos).
4. O PDF gerado usa o tamanho escolhido nas quatro colunas de horario; as demais colunas permanecem no tamanho atual (7pt).

## Design Recomendado

### Arquitetura

O valor escolhido flui do estado do componente ate o gerador de PDF, sem persistencia:

`PontoTab.tsx` (estado local) -> `window.pontoAPI.generatePdf({ ..., horarioFontSize })` -> preload (repasse direto, sem mudanca) -> handler IPC `generate-pdf` em `src/main/ipc/handlers.ts` -> `generatePdf(data, logoBuffer, { horarioFontSize })` -> `buildTableBody` usa `options.horarioFontSize` nas quatro celulas de horario.

### Mudancas por arquivo

- `backend/services/generatePdf.ts`: `generatePdf` ganha terceiro parametro opcional `options?: { horarioFontSize?: number }`. `buildTableBody` recebe esse valor e usa `options?.horarioFontSize ?? 10` nas celulas de Entrada/Inicio Intervalo/Fim Intervalo/Saida, substituindo o `fontSize: 10` fixo atual.
- `src/main/ipc/handlers.ts`: handler `generate-pdf` le `horarioFontSize` do input recebido e repassa para `generatePdf`.
- `src/renderer/types/electron.d.ts`: tipo do input de `generatePdf` ganha campo opcional `horarioFontSize?: number`.
- `src/renderer/components/PontoTab.tsx`: novo `useState<number>(10)` para `horarioFontSize`; um `<select>` com opcoes 7-12 exibido perto dos botoes "Gerar PDF"; as duas chamadas existentes a `window.pontoAPI.generatePdf` (em `handleGerarPdfDireto` e `handleGerarPdf`) passam a incluir `horarioFontSize`.
- `src/preload/index.ts`: sem mudanca (ja repassa o objeto inteiro via `ipcRenderer.invoke`).

### Validacao

`horarioFontSize` e restrito pelo `<select>` a valores inteiros de 7 a 12, entao nao ha necessidade de validacao adicional no backend alem de um fallback (`?? 10`) caso o campo venha ausente ou fora da faixa esperada.

### Testes

- Teste unitario em `generatePdf.test.ts`: chamar `generatePdf` com `options.horarioFontSize` customizado e confirmar (via inspecao do `docDefinition` ou snapshot textual) que as quatro colunas de horario usam o valor passado, e que omitir `options` mantem o padrao de 10.
- Confirmar que os testes existentes de `generatePdf.test.ts` continuam passando sem alteracao.

## Criterios de Aceite

- Usuario ve e usa o seletor de tamanho de fonte antes de gerar o PDF, em ambos os fluxos (manual e Excel).
- PDF gerado reflete o tamanho escolhido apenas nas quatro colunas de horario.
- Nao escolher nada (fluxo padrao) gera PDF com fonte 10pt nos horarios, igual ao comportamento atual.
- Demais colunas e estilos do PDF permanecem inalterados.
- `pnpm test` e `pnpm build` passam.
