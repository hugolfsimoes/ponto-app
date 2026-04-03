# 🧠 Especificação do Projeto - PontoApp

Você é um desenvolvedor full stack especialista em Electron, React, Node.js e TypeScript.

Crie uma aplicação desktop chamada **PontoApp** com as seguintes regras:

---

# 🎯 Objetivo

A aplicação deve:

1. Gerar uma planilha Excel padrão de folha de ponto (template)
2. Permitir que o usuário preencha os horários
3. Ler essa planilha preenchida
4. Gerar um PDF final formatado para impressão

---

# ⚙️ Tecnologias

* Electron (desktop)
* React + Vite (frontend)
* Node.js (backend)
* TypeScript
* exceljs (geração de Excel)
* xlsx (leitura de Excel)
* dayjs (datas)
* reportlab (PDF - backend Python OU usar alternativa JS se preferir)

---

# 📁 Estrutura do Projeto

/ponto-app
/electron
main.ts
preload.ts
/frontend
/backend
generateTemplate.ts
processExcel.ts
generatePdf.ts

---

# 📊 Funcionalidade 1: Gerar Template Excel

## Entrada do usuário:

* Mês (ex: março/2026)
* Nome do colaborador
* Seção

## Saída:

Arquivo Excel com:

### Cabeçalho:

Empresa: PROTMAX SERVIÇOS EM CONDOMÍNIO
Nome: {nome}
Seção: {secao}
Mês: {mes/ano}

### Tabela:

| Dia | Dia Semana | Entrada | Início Intervalo | Fim Intervalo | Saída |

Regras:

* Dias do mês devem ser gerados automaticamente (1 até 31)
* Dia da semana deve ser preenchido automaticamente
* Campos de horário ficam vazios
* Usuário pode preencher horários ou escrever "FOLGA"

---

# 🧮 Funcionalidade 2: Processar Excel

A aplicação deve:

1. Ler o Excel preenchido
2. Validar os dados
3. Calcular horas trabalhadas por dia:

Horas Trabalhadas = (Saída - Entrada) - (Saída Intervalo - Entrada Intervalo)

Regras:

* Se linha tiver "FOLGA", considerar 0 horas
* Validar horários inválidos
* Ignorar linhas vazias

---

# 📅 Regra de Semana

* Semana começa no DOMINGO e termina no SÁBADO
* O total semanal deve aparecer:

  * No sábado
  * OU no último dia do mês (se não houver sábado)

---

# 📊 Funcionalidade 3: Gerar PDF

Gerar um PDF com:

## Cabeçalho:

Controle de Presença e Horas de Trabalho
Empresa: PROTMAX SERVIÇOS EM CONDOMÍNIO
Nome: {nome}
Seção: {secao}

## Tabela:

Colunas:

* Dia (1–31)
* Dia da Semana (SEGUNDA, TERÇA…)
* Horário Entrada
* Início Intervalo
* Fim Intervalo
* Horário Saída
* Total Semana (somente no fechamento)
* Assinatura do Funcionário
* Justificativa (campo em branco)

Regras:

* NÃO exibir "Total Dia"
* Justificativa deve ficar vazia (preenchimento manual)
* Domingos podem aparecer como FOLGA
* Horários devem estar no formato HH:mm

---

# 📌 Rodapé do PDF

* Total Mensal: XX:XX
* Campo: Data ****/****/____
* Campo: Assinatura do Supervisor

---

# 🎨 Layout

* PDF deve caber em UMA página (A4 vertical)
* Colunas compactas
* Assinatura maior
* Justificativa menor

---

# 🔄 Fluxo da Aplicação

1. Usuário preenche dados (nome, seção, mês)
2. Clica em "Gerar Planilha"
3. Preenche o Excel
4. Faz upload
5. Clica em "Gerar PDF"
6. Baixa o PDF final

---

# 🧼 Requisitos de código

* Usar TypeScript
* Separar responsabilidades (backend/frontend)
* Criar funções reutilizáveis
* Validar entradas
* Código limpo e organizado

---

# 🎯 Entregáveis

* Projeto funcional completo
* Geração de Excel funcionando
* Leitura de Excel funcionando
* Geração de PDF funcionando
* Scripts:
  pnpm run dev
  pnpm run build

---

# 🚀 Extra (se possível)

* Validação de erro amigável
* Feedback visual no frontend (loading, sucesso, erro)
