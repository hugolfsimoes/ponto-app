import { JSX, useEffect, useMemo, useState } from 'react'
import type {
  BuildPontoDataResult,
  Employee,
  Organization,
  PdfResult,
  PontoHeader,
} from '../types/electron'
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

const ANO_ATUAL = new Date().getFullYear()

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
]

const HORARIO_FONT_SIZE_OPTIONS = [7, 8, 9, 10, 11, 12]
const DEFAULT_HORARIO_FONT_SIZE = 10

const FALLBACK_DEFAULT_SCHEDULE: DefaultSchedule = {
  entrada: '08:00',
  inicioIntervalo: '12:00',
  fimIntervalo: '13:00',
  saida: '17:00',
}

type Operacao = 'pdf' | 'validacao'

type Status =
  | { tipo: 'idle' }
  | { tipo: 'loading'; operacao: Operacao }
  | { tipo: 'sucesso'; operacao: Operacao; filePath?: string }
  | { tipo: 'erro'; operacao: Operacao; mensagem: string; lista?: string[] }

interface PontoTabProps {
  organizations: Organization[]
  employees: Employee[]
}

export function shouldShowNoEmployeesHint(
  selectedOrganizationId: string,
  filteredEmployees: Employee[],
): boolean {
  return selectedOrganizationId !== '' && filteredEmployees.length === 0
}

export function resolveEmployeeDefaultSchedule(
  employee?: Employee | null,
): DefaultSchedule {
  return employee?.defaultSchedule ?? FALLBACK_DEFAULT_SCHEDULE
}

export function PontoTab({
  organizations,
  employees,
}: PontoTabProps): JSX.Element {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [horarioFontSize, setHorarioFontSize] = useState(DEFAULT_HORARIO_FONT_SIZE)
  const [rows, setRows] = useState<PontoEditorRow[]>(() =>
    createMonthlyRows(mes, ANO_ATUAL),
  )
  const [status, setStatus] = useState<Status>({ tipo: 'idle' })

  const selectedOrganization = organizations.find(
    (item) => item.id === selectedOrganizationId,
  )
  const selectedEmployee = employees.find(
    (item) => item.id === selectedEmployeeId,
  )
  const filteredEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.organizationId === selectedOrganizationId,
      ),
    [employees, selectedOrganizationId],
  )

  const isLoading = status.tipo === 'loading'

  useEffect(() => {
    if (status.tipo !== 'sucesso') return
    const timer = setTimeout(() => setStatus({ tipo: 'idle' }), 5000)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (
      selectedEmployeeId &&
      !employees.some(
        (employee) =>
          employee.id === selectedEmployeeId &&
          employee.organizationId === selectedOrganizationId,
      )
    ) {
      setSelectedEmployeeId('')
    }
  }, [employees, selectedEmployeeId, selectedOrganizationId])

  useEffect(() => {
    setRows(createMonthlyRows(mes, ANO_ATUAL))
  }, [mes, selectedEmployeeId, selectedOrganizationId])

  async function handleGerarPdfDireto(): Promise<void> {
    if (!selectedOrganization || !selectedEmployee) return
    setStatus({ tipo: 'loading', operacao: 'validacao' })

    const header: PontoHeader = {
      empresa: selectedOrganization.nome,
      nome: selectedEmployee.nome,
      secao: selectedEmployee.setor,
      funcao: selectedEmployee.cargoFuncao,
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
              : (buildResult.error ?? 'Não foi possível validar a grade.'),
          lista,
        })
        return
      }

      setStatus({ tipo: 'loading', operacao: 'pdf' })

      const pdfResult = (await window.pontoAPI.generatePdf({
        data: buildResult.data,
        logoPath: selectedOrganization.logoPath,
        horarioFontSize,
      })) as PdfResult

      if (pdfResult.canceled) {
        setStatus({ tipo: 'idle' })
        return
      }
      if (!pdfResult.success) {
        setStatus({
          tipo: 'erro',
          operacao: 'pdf',
          mensagem: pdfResult.error ?? 'Não foi possível gerar o PDF.',
        })
        return
      }

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

  function dismissErro(): void {
    setStatus({ tipo: 'idle' })
  }

  if (organizations.length === 0) {
    return (
      <p style={s.emptyState}>
        Nenhuma empresa cadastrada. Abra a aba Cadastros para adicionar a primeira
        empresa.
      </p>
    )
  }

  return (
    <>
      <div style={s.campos}>
        <div style={s.campo}>
          <label htmlFor='organization' style={s.label}>
            Empresa
          </label>
          <select
            id='organization'
            value={selectedOrganizationId}
            onChange={(event) => {
              setSelectedOrganizationId(event.target.value)
              setSelectedEmployeeId('')
            }}
            disabled={isLoading}
            style={s.select}
          >
            <option value=''>Selecione uma empresa</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.nome}
              </option>
            ))}
          </select>
          {shouldShowNoEmployeesHint(selectedOrganizationId, filteredEmployees) && (
            <p style={s.emptyHint}>
              Esta empresa ainda não tem funcionários cadastrados.
            </p>
          )}
        </div>

        <div style={s.campo}>
          <label htmlFor='employee' style={s.label}>
            Funcionário
          </label>
          <select
            id='employee'
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            disabled={isLoading || !selectedOrganizationId}
            style={s.select}
          >
            <option value=''>Selecione um funcionário</option>
            {filteredEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={s.campo}>
          <label htmlFor='setor' style={s.label}>
            Setor
          </label>
          <input
            id='setor'
            type='text'
            value={selectedEmployee?.setor ?? ''}
            readOnly
            placeholder='Setor'
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
      </div>

      <div style={s.editorActions}>
        <button
          type='button'
          onClick={() =>
            setRows((current) =>
              applyDefaultSchedule(
                current,
                resolveEmployeeDefaultSchedule(selectedEmployee),
              ),
            )
          }
          disabled={!selectedEmployee || isLoading}
          style={{
            ...s.botao,
            ...s.botaoAzul,
            ...(!selectedEmployee || isLoading ? s.botaoDesabilitado : {}),
          }}
        >
          Aplicar horário padrão
        </button>

        <button
          type='button'
          onClick={handleGerarPdfDireto}
          disabled={!selectedOrganization || !selectedEmployee || isLoading}
          title={
            !selectedOrganization || !selectedEmployee
              ? 'Selecione empresa e funcionário primeiro'
              : ''
          }
          style={{
            ...s.botao,
            ...s.botaoLaranja,
            ...(!selectedOrganization || !selectedEmployee || isLoading
              ? s.botaoDesabilitado
              : {}),
          }}
        >
          {isLoading &&
          (status.operacao === 'validacao' || status.operacao === 'pdf') ? (
            <>
              <span className='spinner' />
              Gerando PDF…
            </>
          ) : (
            'Gerar PDF'
          )}
        </button>
      </div>

      <div style={s.editorTable}>
        <div style={s.editorHeaderRow}>
          <span>Dia</span>
          <span>Semana</span>
          <span>Entrada</span>
          <span>Início Intervalo</span>
          <span>Fim Intervalo</span>
          <span>Saída</span>
          <span>Folga</span>
          <span>Feriado</span>
        </div>
        {rows.map((row) => (
          <div key={row.dia} style={s.editorRow}>
            <span style={s.dayCell}>{row.dia}</span>
            <span style={s.weekCell}>{row.diaSemana}</span>
            {(['entrada', 'inicioIntervalo', 'fimIntervalo', 'saida'] as const).map(
              (field) => (
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
              ),
            )}
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

      {status.tipo === 'loading' && (
        <div style={s.infoLoading}>
          <span className='spinner' />
          {
            {
              validacao: 'Validando grade…',
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
                validacao: '✓ Grade validada!',
                pdf: '✓ PDF gerado!',
              }[status.operacao]
            }
          </strong>
          {status.filePath && <p style={s.infoPath}>Salvo em: {status.filePath}</p>}
        </div>
      )}

      {status.tipo === 'erro' && (
        <div style={s.infoErro}>
          <div style={s.erroHeader}>
            <strong>
              {
                {
                  validacao: 'Erro ao validar grade',
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
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
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
    color: '#5f6f84',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #d9e6f5',
    borderRadius: '8px',
    padding: '0 12px',
    fontSize: '0.93rem',
    color: '#082f63',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    minHeight: 40,
  },
  select: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid #d9e6f5',
    borderRadius: '8px',
    padding: '0 12px',
    fontSize: '0.93rem',
    color: '#082f63',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    minHeight: 40,
  },
  editorActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.65rem',
    marginBottom: '1rem',
  },
  editorTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    overflowX: 'auto',
    paddingBottom: '0.25rem',
  },
  editorHeaderRow: {
    display: 'grid',
    gridTemplateColumns: '44px 92px repeat(4, minmax(92px, 1fr)) 60px 60px',
    gap: '0.35rem',
    alignItems: 'center',
    minWidth: 680,
    color: '#5f6f84',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  editorRow: {
    display: 'grid',
    gridTemplateColumns: '44px 92px repeat(4, minmax(92px, 1fr)) 60px 60px',
    gap: '0.35rem',
    alignItems: 'center',
    minWidth: 680,
  },
  dayCell: {
    color: '#082f63',
    fontSize: '0.86rem',
    fontWeight: 700,
  },
  weekCell: {
    color: '#5f6f84',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  timeInput: {
    width: '100%',
    minHeight: 34,
    border: '1px solid #d9e6f5',
    borderRadius: '6px',
    padding: '0 8px',
    color: '#082f63',
    fontSize: '0.86rem',
    outline: 'none',
  },
  folgaCell: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 34,
  },
  emptyState: {
    padding: '0.85rem 1rem',
    background: '#f2f8ff',
    border: '1px solid #d9e6f5',
    borderRadius: '8px',
    color: '#5f6f84',
    fontSize: '0.9rem',
  },
  emptyHint: {
    color: '#5f6f84',
    fontSize: '0.8rem',
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
  botaoLaranja: { background: '#c2410c' },
  botaoDesabilitado: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  infoLoading: {
    marginTop: '1rem',
    padding: '0.65rem 0.9rem',
    background: '#f2f8ff',
    border: '1px solid #d9e6f5',
    borderRadius: '7px',
    color: '#5f6f84',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
  },
  infoSucesso: {
    marginTop: '1rem',
    padding: '0.75rem 0.9rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '7px',
    color: '#15803d',
    fontSize: '0.85rem',
  },
  infoErro: {
    marginTop: '1rem',
    padding: '0.75rem 0.9rem',
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '7px',
    color: '#be123c',
    fontSize: '0.85rem',
  },
  erroHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: '#be123c',
    cursor: 'pointer',
    fontSize: '1.2rem',
    lineHeight: 1,
    padding: 0,
  },
  infoPath: {
    marginTop: '0.35rem',
    fontSize: '0.78rem',
    opacity: 0.85,
    wordBreak: 'break-all',
  },
  erroLista: {
    marginTop: '0.5rem',
    paddingLeft: '1rem',
  },
  erroItem: {
    marginBottom: '0.25rem',
  },
}
