import { JSX, useEffect, useState } from 'react';
import type {
  PontoHeader,
  TemplateResult,
  ProcessResult,
  PdfResult,
} from '../types/electron';
import logoProtmax from '../../../resources/protmax.jpeg';

const ANO_ATUAL = new Date().getFullYear();

const MESES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
];

type Operacao = 'planilha' | 'excel' | 'pdf';

type Status =
  | { tipo: 'idle' }
  | { tipo: 'loading'; operacao: Operacao }
  | { tipo: 'sucesso'; operacao: Operacao; filePath?: string }
  | { tipo: 'erro'; operacao: Operacao; mensagem: string; lista?: string[] };

export function TemplateForm(): JSX.Element {
  const [nome, setNome] = useState('');
  const [secao, setSecao] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [excelData, setExcelData] = useState<unknown>(null);
  const [doneOps, setDoneOps] = useState<Set<Operacao>>(new Set());
  const [status, setStatus] = useState<Status>({ tipo: 'idle' });

  const isLoading = status.tipo === 'loading';
  const podeGerarPlanilha =
    !isLoading && nome.trim() !== '' && secao.trim() !== '';
  const podeGerarPdf = !isLoading && excelData !== null;

  // Auto-dismiss mensagens de sucesso após 5 segundos
  useEffect(() => {
    if (status.tipo !== 'sucesso') return;
    const timer = setTimeout(() => setStatus({ tipo: 'idle' }), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  function markDone(op: Operacao): void {
    setDoneOps((prev) => new Set([...prev, op]));
  }

  async function handleGerarPlanilha(): Promise<void> {
    if (!podeGerarPlanilha) return;
    setStatus({ tipo: 'loading', operacao: 'planilha' });

    const header: PontoHeader = {
      empresa: 'PROTMAX SERVIÇOS EM CONDOMÍNIO',
      nome: nome.trim(),
      secao: secao.trim(),
      mes,
      ano: ANO_ATUAL,
    };

    try {
      const resultado = (await window.pontoAPI.generateTemplate(
        header,
      )) as TemplateResult;
      if (resultado.canceled) {
        setStatus({ tipo: 'idle' });
        return;
      }
      if (!resultado.success) {
        setStatus({
          tipo: 'erro',
          operacao: 'planilha',
          mensagem: resultado.error ?? 'Não foi possível gerar a planilha.',
        });
        return;
      }
      markDone('planilha');
      setStatus({
        tipo: 'sucesso',
        operacao: 'planilha',
        filePath: resultado.filePath,
      });
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'planilha',
        mensagem:
          err instanceof Error
            ? err.message
            : 'Erro inesperado ao gerar planilha.',
      });
    }
  }

  async function handleSelecionarExcel(): Promise<void> {
    setStatus({ tipo: 'loading', operacao: 'excel' });

    try {
      const resultado = (await window.pontoAPI.processExcel(
        '',
      )) as ProcessResult;
      if (resultado.canceled) {
        setStatus({ tipo: 'idle' });
        return;
      }
      if (!resultado.success) {
        const lista = resultado.errors?.map((e) => e.mensagem);
        const mensagem =
          lista && lista.length > 0
            ? `${lista.length} erro(s) encontrado(s) na planilha`
            : (resultado.error ?? 'Não foi possível processar o arquivo.');
        setStatus({ tipo: 'erro', operacao: 'excel', mensagem, lista });
        return;
      }
      setExcelData(resultado.data);
      markDone('excel');
      setStatus({ tipo: 'sucesso', operacao: 'excel' });
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'excel',
        mensagem:
          err instanceof Error
            ? err.message
            : 'Erro inesperado ao processar arquivo.',
      });
    }
  }

  async function handleGerarPdf(): Promise<void> {
    if (!podeGerarPdf) return;
    setStatus({ tipo: 'loading', operacao: 'pdf' });

    try {
      const resultado = (await window.pontoAPI.generatePdf(
        excelData,
      )) as PdfResult;
      if (resultado.canceled) {
        setStatus({ tipo: 'idle' });
        return;
      }
      if (!resultado.success) {
        setStatus({
          tipo: 'erro',
          operacao: 'pdf',
          mensagem: resultado.error ?? 'Não foi possível gerar o PDF.',
        });
        return;
      }
      markDone('pdf');
      setStatus({
        tipo: 'sucesso',
        operacao: 'pdf',
        filePath: resultado.filePath,
      });
    } catch (err) {
      setStatus({
        tipo: 'erro',
        operacao: 'pdf',
        mensagem:
          err instanceof Error ? err.message : 'Erro inesperado ao gerar PDF.',
      });
    }
  }

  function dismissErro(): void {
    setStatus({ tipo: 'idle' });
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        {/* Cabeçalho */}
        <div style={s.header}>
          <img src={logoProtmax} alt='PROTMAX' style={s.logo} />
          <div style={s.headerText}>
            <h1 style={s.titulo}>PROTMAX</h1>
          </div>
        </div>

        {/* Indicador de passos */}
        <div style={s.steps}>
          <StepDot
            num={1}
            label='Planilha'
            done={doneOps.has('planilha')}
            active={podeGerarPlanilha}
          />
          <div style={s.stepLine} />
          <StepDot
            num={2}
            label='Excel'
            done={doneOps.has('excel')}
            active={true}
          />
          <div style={s.stepLine} />
          <StepDot
            num={3}
            label='PDF'
            done={doneOps.has('pdf')}
            active={podeGerarPdf}
          />
        </div>

        <div style={s.divider} />

        {/* Formulário */}
        <div style={s.campos}>
          <div style={s.campo}>
            <label htmlFor='nome' style={s.label}>
              Nome do Colaborador
            </label>
            <input
              id='nome'
              type='text'
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder='Ex: João da Silva'
              disabled={isLoading}
              style={s.input}
            />
          </div>

          <div style={s.campo}>
            <label htmlFor='secao' style={s.label}>
              Seção
            </label>
            <input
              id='secao'
              type='text'
              value={secao}
              onChange={(e) => setSecao(e.target.value)}
              placeholder='Ex: Portaria, Limpeza'
              disabled={isLoading}
              style={s.input}
            />
          </div>

          <div style={s.campo}>
            <label htmlFor='mes' style={s.label}>
              Mês
            </label>
            <select
              id='mes'
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              disabled={isLoading}
              style={s.select}
            >
              {MESES.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botões de ação */}
        <div style={s.botoes}>
          <button
            onClick={handleGerarPlanilha}
            disabled={!podeGerarPlanilha}
            title={
              !nome.trim() || !secao.trim()
                ? 'Preencha nome e seção primeiro'
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

        {/* Badge: Excel carregado */}
        {excelData !== null && (
          <div style={s.badgeExcel}>
            ✓ Planilha carregada — pronta para gerar PDF
          </div>
        )}

        {/* Feedback de status */}
        {status.tipo === 'loading' && (
          <div style={s.infoLoading}>
            <span className='spinner' />
            {
              {
                planilha: 'Gerando planilha…',
                excel: 'Processando arquivo…',
                pdf: 'Gerando PDF…',
              }[status.operacao]
            }
          </div>
        )}

        {status.tipo === 'sucesso' && (
          <div style={s.infoSucesso}>
            <strong>
              {
                {
                  planilha: '✓ Planilha gerada!',
                  excel: '✓ Arquivo carregado!',
                  pdf: '✓ PDF gerado!',
                }[status.operacao]
              }
            </strong>
            {status.filePath && (
              <p style={s.infoPath}>Salvo em: {status.filePath}</p>
            )}
          </div>
        )}

        {status.tipo === 'erro' && (
          <div style={s.infoErro}>
            <div style={s.erroHeader}>
              <strong>
                {
                  {
                    planilha: 'Erro ao gerar planilha',
                    excel: 'Erro ao processar Excel',
                    pdf: 'Erro ao gerar PDF',
                  }[status.operacao]
                }
              </strong>
              <button onClick={dismissErro} style={s.dismissBtn} title='Fechar'>
                ×
              </button>
            </div>
            <p style={s.infoPath}>{status.mensagem}</p>
            {status.lista && status.lista.length > 0 && (
              <ul style={s.erroLista}>
                {status.lista.slice(0, 5).map((msg, i) => (
                  <li key={i} style={s.erroItem}>
                    {msg}
                  </li>
                ))}
                {status.lista.length > 5 && (
                  <li style={{ ...s.erroItem, opacity: 0.7 }}>
                    … e mais {status.lista.length - 5} erro(s)
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente auxiliar: indicador de passo ───────────────────────────────────

interface StepDotProps {
  num: number;
  label: string;
  done: boolean;
  active: boolean;
}

function StepDot({ num, label, done, active }: StepDotProps): JSX.Element {
  const dotColor = done ? '#22c55e' : active ? '#2e75b6' : '#484848';
  const labelColor = done ? '#6ee7b7' : active ? '#93b8d8' : '#666';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: dotColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#fff',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        {done ? '✓' : num}
      </div>
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          color: labelColor,
          transition: 'color 0.2s',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '1.5rem 1rem',
    background: '#303030',
  },
  card: {
    background: '#3d3d3d',
    borderRadius: '14px',
    padding: '2rem 1.75rem',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    marginBottom: '1.5rem',
  },
  logo: {
    width: 52,
    height: 52,
    objectFit: 'contain',
    borderRadius: 8,
    flexShrink: 0,
    background: '#2a2a2a',
  },
  headerText: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  titulo: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '0.02em',
  },
  empresa: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#777',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
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
    background: '#4a4a4a',
    maxWidth: '60px',
    margin: '0 4px',
    marginBottom: '18px',
  },
  divider: {
    height: '1px',
    background: '#4a4a4a',
    marginBottom: '1.5rem',
  },
  campos: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#bbb',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    background: '#2a2a2a',
    border: '1.5px solid #505050',
    borderRadius: '7px',
    padding: '0.6rem 0.85rem',
    fontSize: '0.93rem',
    color: '#f0f0f0',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  select: {
    width: '100%',
    background: '#2a2a2a',
    border: '1.5px solid #505050',
    borderRadius: '7px',
    padding: '0.6rem 0.85rem',
    fontSize: '0.93rem',
    color: '#f0f0f0',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  botoes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },
  botao: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.7rem 1.25rem',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.1s',
    color: '#fff',
    width: '100%',
  },
  botaoAzul: { background: '#2563a8' },
  botaoVerde: { background: '#1a6e36' },
  botaoLaranja: { background: '#b84f00' },
  botaoDesabilitado: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  badgeExcel: {
    marginTop: '1rem',
    padding: '0.5rem 0.8rem',
    background: '#142b1a',
    border: '1px solid #1f5c2e',
    borderRadius: '6px',
    color: '#4ade80',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  infoLoading: {
    marginTop: '1rem',
    padding: '0.65rem 0.9rem',
    background: '#2a2a2a',
    border: '1px solid #505050',
    borderRadius: '7px',
    color: '#999',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
  },
  infoSucesso: {
    marginTop: '1rem',
    padding: '0.65rem 0.9rem',
    background: '#122318',
    border: '1px solid #1e5c2a',
    borderRadius: '7px',
    color: '#4ade80',
    fontSize: '0.875rem',
  },
  infoErro: {
    marginTop: '1rem',
    padding: '0.65rem 0.9rem',
    background: '#2b1212',
    border: '1px solid #6b2020',
    borderRadius: '7px',
    color: '#f87171',
    fontSize: '0.875rem',
  },
  erroHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#f87171',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: '0 2px',
    opacity: 0.7,
  },
  infoPath: {
    marginTop: '0.2rem',
    fontSize: '0.78rem',
    wordBreak: 'break-all',
    opacity: 0.8,
  },
  erroLista: {
    marginTop: '0.4rem',
    paddingLeft: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  erroItem: {
    fontSize: '0.78rem',
    opacity: 0.9,
    lineHeight: 1.4,
  },
};
