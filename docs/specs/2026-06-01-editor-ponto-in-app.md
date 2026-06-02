# Editor de Ponto In-App

## Contexto

Hoje o usuario precisa gerar uma planilha, abrir o arquivo fora do app, preencher horarios e folgas, salvar, voltar ao app, selecionar o Excel e so entao gerar o PDF. Esse fluxo funciona, mas cria atrito e aumenta a chance de erro operacional.

O app ja tem a maior parte da base necessaria para eliminar esse caminho: `generatePdf` recebe um `PontoData`, `calculateHours` calcula os minutos por dia e `groupByWeek` monta os totais semanais. O Excel hoje e apenas a origem dos dados. A melhoria proposta e permitir que o usuario crie esses dados diretamente na tela.

## Objetivo

Permitir preencher horas e folgas diretamente no app para um funcionario por vez e gerar o PDF sem baixar ou subir modelo Excel.

## Fora de Escopo

- Geracao em lote para varios funcionarios.
- Persistencia historica das folhas preenchidas.
- Preview visual do PDF dentro do app.
- Mudanca do layout do PDF.
- Remocao do fluxo Excel existente.

## Fluxo do Usuario

1. Abrir a aba Ponto.
2. Selecionar empresa, funcionario e mes.
3. O app exibe uma grade com todos os dias do mes.
4. O usuario preenche entrada, inicio do intervalo, fim do intervalo e saida.
5. O usuario pode marcar um dia como folga; nesse caso os quatro campos do dia ficam como `FOLGA`.
6. O app mostra o total diario e os totais semanais/mensal.
7. O usuario clica em Gerar PDF.
8. O app valida os dados, pede o local de salvamento e gera o PDF com a logo da empresa selecionada.

## Abordagens Avaliadas

### A. Editor mensal direto no app, mantendo Excel como opcional

Esta e a abordagem recomendada. O editor vira o caminho principal para gerar PDF, mas os botoes de planilha/processamento continuam disponiveis como alternativa. Ela entrega reducao imediata de etapas, preserva compatibilidade com usuarios que ainda preferem Excel e reaproveita os servicos atuais.

### B. Substituir totalmente o fluxo Excel

Remove a complexidade visual da tela, mas e mais arriscado porque elimina uma funcionalidade que ja funciona e pode ser util para casos onde o usuario recebe dados de fora.

### C. Gerar Excel temporario em segundo plano

Evita mexer no contrato de dados do PDF, mas mantem uma dependencia artificial do Excel e cria arquivos intermediarios desnecessarios. Como o PDF ja consome `PontoData`, essa abordagem adiciona trabalho sem beneficio real.

## Design Recomendado

### Arquitetura

Criar um servico backend `buildPontoDataFromManualInput` que recebe `PontoHeader` e uma lista de registros manuais. Esse servico valida os dias, calcula `minutesTrabalhados`, agrupa semanas e retorna `PontoData`. O renderer envia esse `PontoData` ao handler `generate-pdf` ja existente.

O fluxo Excel continua usando `processExcel`. Assim, as duas entradas de dados convergem no mesmo contrato `PontoData` antes da geracao do PDF.

### Modelo de Dados

Adicionar um tipo `ManualPontoRecordInput` com:

- `dia`
- `entrada`
- `inicioIntervalo`
- `fimIntervalo`
- `saida`
- `folga`

Os campos de horario usam `TimeEntry | null`, iguais ao modelo existente. Folga usa `folga: true` e horarios nulos no payload interno; a UI pode exibir `FOLGA` nos campos bloqueados.

### Validacao

As regras devem espelhar o Excel:

- Em dia normal, os quatro horarios sao obrigatorios.
- Em dia normal, a ordem deve ser `entrada <= inicioIntervalo <= fimIntervalo <= saida`.
- Em folga, os horarios sao ignorados e o total diario e `00:00`.
- Dias fora do mes geram erro.
- Deve existir um registro para cada dia do mes na grade in-app.

Erros devem ser retornados como `ValidationError[]`, com mensagens por dia e campo para reaproveitar a exibicao de erros ja existente.

### Interface

A aba Ponto passa a ter dois blocos:

1. Dados da folha: empresa, funcionario, setor e mes.
2. Grade mensal editavel: um dia por linha, quatro campos de horario, toggle de folga e total diario.

O caminho principal deve ser:

- Aplicar horario padrao opcional: preenche todos os dias uteis com o mesmo horario.
- Editar excecoes.
- Marcar folgas.
- Gerar PDF.

O fluxo antigo fica em uma secao secundaria chamada "Usar planilha Excel", com gerar planilha, selecionar Excel e gerar PDF a partir do Excel carregado.

### Estados e Feedback

- Sem empresa cadastrada: manter empty state atual.
- Empresa sem funcionarios: manter hint atual.
- Sem funcionario selecionado: grade desabilitada.
- Dados invalidos: listar ate cinco erros, mantendo o padrao atual.
- PDF gerado: mostrar caminho salvo.
- Cancelamento do dialog de salvar: voltar para estado idle.

### Testes

- Testar o novo servico backend com mes completo, folga, horarios invalidos e dia fora do mes.
- Testar helper de criacao da grade mensal no renderer.
- Testar renderizacao estatica da aba Ponto para confirmar que o editor aparece.
- Testar que o handler `generate-pdf` continua aceitando `PontoData` vindo de qualquer origem.

## Criterios de Aceite

- Usuario consegue gerar PDF sem criar ou selecionar Excel.
- O PDF gerado usa empresa, funcionario, setor, mes, ano e logo corretos.
- Folgas aparecem como `FOLGA` no PDF.
- Totais diario, semanal e mensal batem com os horarios preenchidos.
- O fluxo Excel antigo permanece disponivel.
- `pnpm test` e `pnpm build` passam.
