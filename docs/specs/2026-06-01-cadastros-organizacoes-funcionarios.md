# Cadastro de Organizacoes e Funcionarios

## Contexto

O PontoApp hoje gera uma planilha de ponto a partir de campos digitados manualmente: empresa fixa, nome do colaborador, secao, mes e ano. O objetivo desta evolucao e tornar o aplicativo reutilizavel para clientes que controlam ponto de varias empresas, reduzindo digitacao repetida e evitando erros em nome, setor e logo.

Cada organizacao representa uma empresa do cliente. Uma organizacao possui funcionarios proprios. No fluxo principal, o usuario escolhe a organizacao e depois escolhe um funcionario daquela organizacao; o setor do funcionario e preenchido automaticamente.

## Objetivos

- Permitir cadastrar, editar e excluir organizacoes.
- Exigir uma logo para cada organizacao.
- Permitir cadastrar, editar e excluir funcionarios vinculados a uma organizacao.
- Trocar os campos livres de nome e secao por dropdowns dependentes no fluxo de geracao de ponto.
- Usar a logo da organizacao selecionada no Excel e no PDF.
- Substituir a identidade visual fixa atual pela marca Ponto App no aplicativo.
- Persistir dados localmente na pasta de dados do aplicativo instalado.
- Permitir exportar e importar backup para troca de computador.

## Fora de Escopo

- Autenticacao de usuarios.
- Banco de dados remoto ou sincronizacao em nuvem.
- Historico de alteracoes.
- Mesclagem inteligente ao importar backup.
- Cadastro de CPF, matricula, cargo, jornada padrao ou escala.
- Logos diferentes por funcionario.

## Modelo de Dados

```ts
export interface Organization {
  id: string
  nome: string
  logoPath: string
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  organizationId: string
  nome: string
  setor: string
  createdAt: string
  updatedAt: string
}

export interface LocalData {
  version: 1
  organizations: Organization[]
  employees: Employee[]
}
```

Regras:

- `Organization.nome` e obrigatorio.
- `Organization.logoPath` aponta para uma copia local da logo dentro da pasta de dados do app.
- Logos aceitas: `.png`, `.jpg`, `.jpeg`.
- `Employee.nome` e `Employee.setor` sao obrigatorios.
- Ao excluir uma organizacao, seus funcionarios tambem sao excluidos.
- Toda exclusao precisa de confirmacao visual antes da chamada destrutiva.

## Persistencia Local

Os dados serao salvos via processo principal do Electron, usando `app.getPath('userData')`.

Estrutura sugerida:

```text
<userData>/
  pontoapp-data/
    dados.json
    logos/
      <organization-id>.<ext>
```

O arquivo `dados.json` contem apenas dados estruturados. As imagens ficam em `logos/`. Ao cadastrar ou editar a logo de uma organizacao, o app copia a imagem escolhida para essa pasta, evitando dependencia do caminho original selecionado pelo usuario.

O renderer nao acessa o file system diretamente. Ele usa APIs expostas pelo preload e implementadas por handlers IPC.

## APIs IPC

Novas chamadas expostas por `window.pontoAPI`:

```ts
loadLocalData(): Promise<LocalData>
createOrganization(input: { nome: string; logoSourcePath: string }): Promise<Organization>
updateOrganization(input: { id: string; nome: string; logoSourcePath?: string }): Promise<Organization>
deleteOrganization(id: string): Promise<{ success: boolean }>
createEmployee(input: { organizationId: string; nome: string; setor: string }): Promise<Employee>
updateEmployee(input: { id: string; nome: string; setor: string }): Promise<Employee>
deleteEmployee(id: string): Promise<{ success: boolean }>
selectLogoFile(): Promise<{ canceled?: boolean; filePath?: string }>
exportBackup(): Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
importBackup(): Promise<{ success: boolean; canceled?: boolean; error?: string }>
```

A chamada `generateTemplate` deve receber tambem a referencia da logo da organizacao selecionada. Para manter o `PontoHeader` focado nos dados impressos, o contrato recomendado e:

```ts
generateTemplate(input: {
  header: PontoHeader
  logoPath?: string
})
```

Para compatibilidade interna durante a migracao, o handler pode aceitar temporariamente o formato antigo `PontoHeader`, mas a UI nova deve usar o formato novo.

Para PDF, `PontoData.header.empresa` passa a ser o nome da organizacao. A geracao do PDF tambem precisa receber ou resolver a logo da organizacao selecionada. Como os dados processados a partir do Excel contem apenas o header, o fluxo da UI deve manter a organizacao selecionada e chamar:

```ts
generatePdf({
  data: PontoData
  logoPath?: string
})
```

## Interface

A tela principal passa a ter duas abas:

### Aba Ponto

- Dropdown de organizacao.
- Dropdown de funcionario, filtrado pela organizacao selecionada.
- Campo de setor somente leitura, preenchido automaticamente.
- Select de mes.
- Botoes atuais:
  - gerar planilha
  - selecionar Excel
  - gerar PDF
- Estado vazio quando nao houver organizacoes ou funcionarios cadastrados.

Comportamento:

- Ao selecionar uma organizacao, limpar a selecao de funcionario se ele nao pertencer mais aquela organizacao.
- Ao selecionar um funcionario, preencher setor automaticamente.
- O botao de gerar planilha fica desabilitado sem organizacao, funcionario e setor.
- O Excel gerado usa `header.empresa = organization.nome`, `header.nome = employee.nome`, `header.secao = employee.setor`.
- O PDF usa a logo da organizacao selecionada.

### Aba Cadastros

Secao de organizacoes:

- Lista de organizacoes cadastradas.
- Formulario para criar/editar organizacao.
- Campos: nome e logo obrigatoria.
- Ao editar, a logo atual permanece se o usuario nao escolher outra.
- Excluir organizacao exige confirmacao; ao confirmar, remove a organizacao, seus funcionarios e sua logo local.

Secao de funcionarios:

- Dropdown de organizacao para filtrar funcionarios.
- Lista de funcionarios daquela organizacao.
- Formulario para criar/editar funcionario.
- Campos: nome e setor.
- Excluir funcionario exige confirmacao.

Secao de backup:

- Exportar backup gera um arquivo `.zip` com `dados.json` e `logos/`.
- Importar backup seleciona um `.zip` e substitui os dados locais apos confirmacao.

## Identidade Visual do App

A imagem adicionada pelo usuario em `src/assets/img/appImage.png` sera a identidade principal do aplicativo.

Regras:

- Usar `src/assets/img/appImage.png` no renderer.
- Copiar `src/assets/img/appImage.png` para `resources/pontoapp.png` durante a implementacao, para configurar o icone/assets do app empacotado.
- Usar a marca Ponto App no cabecalho da interface, substituindo a exibicao fixa da logo PROTMAX.
- Manter as logos das organizacoes como dados dos clientes, usadas no Excel e no PDF.
- Configurar o icone do aplicativo/build para usar a nova imagem quando o formato for suportado.
- Ajustar a estilização do app para combinar com a marca: fundo claro, azul primario vivo, azul-marinho para textos principais, botoes com estado claro de foco/hover e visual limpo.
- Evitar uma interface toda em tons de uma unica cor; usar branco/cinzas claros como base, azul como acento e contraste escuro nos textos.

## Backup e Restauracao

O backup deve ser um arquivo unico `.zip`, por exemplo `pontoapp-backup-2026-06-01.zip`, contendo:

```text
dados.json
logos/
  ...
```

Na importacao:

- Validar se o ZIP contem `dados.json`.
- Validar se `dados.json` respeita `version: 1`.
- Validar se as organizacoes referenciam logos existentes no backup.
- Mostrar confirmacao antes de substituir os dados locais.
- Restaurar primeiro para uma pasta temporaria dentro de `userData`; depois substituir a pasta ativa. Isso reduz risco de deixar dados parcialmente importados se algo falhar.

## Tratamento de Erros

- Falha ao ler dados locais: recriar `dados.json` vazio se o arquivo nao existir; retornar erro se o JSON estiver corrompido.
- Logo invalida: bloquear salvamento e informar que apenas PNG/JPG/JPEG sao aceitos.
- Organizacao inexistente ao salvar funcionario: retornar erro amigavel.
- Funcionario inexistente ao editar/excluir: retornar erro amigavel.
- Backup invalido: nao alterar dados atuais e mostrar mensagem de erro.
- Importacao cancelada: manter dados atuais sem alteracao.

## Testes e Verificacao

Testes unitarios recomendados para:

- Repositorio local cria `dados.json` vazio quando necessario.
- Criar/editar/excluir organizacao copia/remove logo corretamente.
- Excluir organizacao remove funcionarios vinculados.
- Criar/editar/excluir funcionario valida campos obrigatorios.
- Exportar backup inclui JSON e logos.
- Importar backup substitui dados locais somente quando valido.
- Renderer usa a marca Ponto App no shell e nao renderiza mais a identidade fixa PROTMAX.
- Tabs aplicam classes de estado ativo compativeis com a identidade visual.
- Aba Ponto mostra estado vazio quando nao ha organizacoes cadastradas.
- Aba Ponto mostra aviso quando a organizacao selecionada nao tem funcionarios.
- Aba Cadastros exibe mensagens `error` retornadas pelo backend em operacoes CRUD.

Configuracao de testes:

- `pnpm test` deve executar tanto testes backend (`backend/**/*.test.ts`) quanto testes renderer (`src/**/*.test.ts` e `src/**/*.test.tsx`).
- Testes de renderer podem usar renderizacao estatica React para validar textos, classes e regras puras de estado sem depender do Electron.

Verificacao manual:

- Criar duas empresas com logos diferentes.
- Criar funcionarios em cada empresa.
- Confirmar que o dropdown de funcionarios muda conforme a empresa.
- Gerar planilha e conferir nome da empresa, funcionario, setor e logo.
- Processar Excel e gerar PDF com a logo correta.
- Exportar backup, limpar dados localmente em ambiente de teste e importar backup.

## Decisoes Aprovadas

- Organizacao significa empresa do cliente.
- Logo da organizacao e obrigatoria.
- Funcionario tem apenas nome e setor nesta versao.
- Excluir organizacao e funcionario e definitivo, sempre com confirmacao.
- A UI tera abas: Ponto e Cadastros.
- Persistencia sera local em JSON, adequada para poucos dados.
- Backup/restore em ZIP faz parte da primeira versao.
