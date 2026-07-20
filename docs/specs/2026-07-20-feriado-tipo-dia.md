# Suporte a Feriado (Tipo de Dia)

## Contexto

Hoje o app so reconhece um estado especial de dia: folga, representado por um campo `folga: boolean` em `PontoRecord` e `ManualPontoRecordInput` (`backend/types/ponto.ts`). Esse campo aparece em quase toda a cadeia: calculo de horas, validacao, importacao de Excel, editor manual e geracao do PDF.

O cliente precisa marcar tambem feriados, que devem se comportar como folga (zero horas trabalhadas, sem exigir os 4 horarios) mas aparecer com o proprio rotulo "FERIADO" em vez de "FOLGA".

## Objetivo

Permitir marcar um dia como FOLGA ou FERIADO (mutuamente exclusivos), no editor manual e na planilha Excel, com o rotulo correto aparecendo no PDF gerado, sem alterar o comportamento de calculo de horas alem de tratar os dois como zero horas.

## Fora de Escopo

- Lista suspensa ou validacao de celula no template Excel gerado (`generateTemplate.ts`). O usuario continua digitando o texto manualmente na planilha, como ja faz com FOLGA.
- Calendario de feriados fixos/nacionais. A marcacao e sempre manual, dia a dia.
- Testes dedicados para `processExcel.ts` (nao existe `processExcel.test.ts` hoje; a cobertura de FOLGA la tambem nao existe, entao FERIADO segue o mesmo padrao).

## Fluxo do Usuario

1. No editor manual (aba Ponto), cada linha do mes tem dois checkboxes: "Folga" e "Feriado".
2. Marcar um dos dois desabilita e limpa os 4 campos de horario da linha, mostrando o texto correspondente ("FOLGA" ou "FERIADO").
3. Marcar um dos checkboxes desmarca automaticamente o outro (mutuamente exclusivos).
4. Desmarcar os dois volta a linha para o estado normal (horarios editaveis).
5. No fluxo Excel, o usuario digita "FOLGA" ou "FERIADO" (case-insensitive) nas 4 celulas de horario do dia; misturar os dois tipos, ou misturar qualquer um deles com horarios reais, no mesmo dia, gera erro de validacao.
6. No PDF gerado, o dia aparece com "FOLGA" ou "FERIADO" em negrito nas 4 colunas de horario, e conta 0 minutos no total do dia/semana/mes.

## Design Recomendado

### Modelo de Dados

Substituir `folga: boolean` por `tipoDia: 'NORMAL' | 'FOLGA' | 'FERIADO'` em:

- `backend/types/ponto.ts`: `PontoRecord.tipoDia`, `ManualPontoRecordInput.tipoDia`.
- `src/renderer/types/electron.d.ts`: mesmo campo, espelhando o tipo backend (documentado no topo do arquivo como espelho intencional).

Um unico campo em vez de dois booleanos evita o estado impossivel "folga e feriado ao mesmo tempo".

### Calculo de Horas

`backend/services/calculateHours.ts`: troca `if (record.folga) return 0` por `if (record.tipoDia !== 'NORMAL') return 0`. Nenhuma outra logica de calculo muda.

### Validacao

- `backend/validators/excelValidator.ts`: troca `if (record.folga) continue` por `if (record.tipoDia !== 'NORMAL') continue` (pula exigencia dos 4 horarios).
- `backend/services/buildPontoDataFromManualInput.ts`: mesma troca; ao montar o registro, forca os 4 horarios para `null` quando `tipoDia !== 'NORMAL'`, senao repassa os valores recebidos.

### Excel (`backend/services/processExcel.ts`)

- Adicionar `FERIADO_RE = /^feriado$/i` ao lado do `FOLGA_RE` existente.
- `classificar()` ganha uma quarta categoria (`'vazio' | 'folga' | 'feriado' | 'valor'`), testando `FERIADO_RE` junto de `FOLGA_RE`.
- Contadores `nFolga`/`nFeriado`/`nVazio` (equivalente ao `nFolga`/`nVazio` atual).
- Regra tudo-ou-nada: as 4 celulas do dia devem ser todas horario, todas FOLGA, ou todas FERIADO. Qualquer mistura entre os tres (incluindo FOLGA misturado com FERIADO) gera o mesmo tipo de erro de validacao ja existente para "nao misture FOLGA com horarios", com mensagem adaptada para citar ambos os tipos.
- Quando todas as 4 celulas forem FOLGA ou todas FERIADO, o registro e construido com `tipoDia: 'FOLGA'` ou `tipoDia: 'FERIADO'` e os 4 horarios `null`.

### Editor Manual (`src/renderer/components/pontoEditor.ts` + `PontoTab.tsx`)

- `PontoEditorRow.tipoDia` substitui `folga: boolean`.
- Duas funcoes exportadas, `toggleFolga` e `toggleFeriado`, cada uma define `tipoDia` para o tipo marcado (limpando os 4 campos de horario da linha) ou volta para `'NORMAL'` quando desmarcado. Marcar um dos dois sempre reseta o outro implicitamente, pois so existe um campo `tipoDia`.
- `updateRowTime()` continua forcando `tipoDia: 'NORMAL'` quando o usuario digita um horario manualmente (equivalente ao `folga: false` atual).
- `applyDefaultSchedule()` continua pulando linhas onde `tipoDia !== 'NORMAL'`.
- `serializeRowsForManualInput()` continua zerando (`null`) os 4 horarios quando `tipoDia !== 'NORMAL'`.
- Em `PontoTab.tsx`: a celula de folga atual vira duas celulas com checkbox ("Folga" e "Feriado"), cada uma disparando `toggleFolga`/`toggleFeriado`. Os inputs de horario mostram o texto do tipo ativo ("FOLGA" ou "FERIADO") como placeholder/valor e ficam desabilitados quando `tipoDia !== 'NORMAL'`, igual ao comportamento atual de folga.

### PDF (`backend/services/generatePdf.ts`)

Cada uma das 4 celulas de horario passa a usar:

```ts
const label = rec.tipoDia === 'FOLGA' ? 'FOLGA' : rec.tipoDia === 'FERIADO' ? 'FERIADO' : null;
// ...
tc(label ?? fmtTime(rec.entrada), { bold: label !== null, fontSize: horarioFontSize }),
```

(equivalente para inicioIntervalo, fimIntervalo, saida), substituindo o ternario atual `folga ? 'FOLGA' : fmtTime(...)`. Mesmo estilo em negrito ja usado para folga.

### Testes

Atualizar os testes existentes que cobrem folga para tambem cobrir feriado (adicionando casos, nao substituindo os de folga):

- `backend/services/calculateHours.test.ts`: caso com `tipoDia: 'FERIADO'` retornando 0 minutos.
- `backend/services/buildPontoDataFromManualInput.test.ts`: caso com dia feriado, confirmando horarios nulos e 0 minutos.
- `backend/validators/excelValidator.test.ts`: caso com `tipoDia: 'FERIADO'` pulando validacao de horarios obrigatorios.
- `src/renderer/components/pontoEditor.test.ts`: casos para `toggleFeriado`, mutua exclusao com `toggleFolga`, e `updateRowTime` voltando o dia para `'NORMAL'`.

Todos os casos existentes de folga devem continuar passando sem alteracao de comportamento.

## Criterios de Aceite

- Usuario consegue marcar um dia como Folga ou Feriado no editor manual, com os checkboxes mutuamente exclusivos.
- Usuario consegue digitar FOLGA ou FERIADO nas celulas de horario da planilha Excel importada.
- Misturar FOLGA, FERIADO e horarios reais no mesmo dia (em qualquer combinacao) gera erro de validacao.
- Dias de folga ou feriado contam 0 minutos no total diario/semanal/mensal.
- PDF gerado mostra "FOLGA" ou "FERIADO" em negrito nas 4 colunas de horario do dia correspondente.
- Todos os testes existentes de folga continuam passando; novos casos de feriado adicionados nos 4 arquivos de teste listados.
- `pnpm test` e `pnpm build` passam.
