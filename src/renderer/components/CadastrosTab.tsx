import { JSX, useMemo, useState } from 'react'
import type { Employee, LocalData, Organization } from '../types/electron'

interface CadastrosTabProps {
  data: LocalData
  onReload: () => Promise<void>
}

export function CadastrosTab({
  data,
  onReload,
}: CadastrosTabProps): JSX.Element {
  const [organizationName, setOrganizationName] = useState('')
  const [organizationLogoPath, setOrganizationLogoPath] = useState('')
  const [editingOrganizationId, setEditingOrganizationId] = useState<
    string | null
  >(null)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    data.organizations[0]?.id ?? '',
  )
  const [employeeName, setEmployeeName] = useState('')
  const [employeeSetor, setEmployeeSetor] = useState('')
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(
    null,
  )
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const selectedOrganization = data.organizations.find(
    (organization) => organization.id === selectedOrganizationId,
  )
  const filteredEmployees = useMemo(
    () =>
      data.employees.filter(
        (employee) => employee.organizationId === selectedOrganizationId,
      ),
    [data.employees, selectedOrganizationId],
  )
  const isEditingOrganization = editingOrganizationId !== null
  const canSaveOrganization =
    organizationName.trim() !== '' &&
    (isEditingOrganization || organizationLogoPath.trim() !== '')
  const canSaveEmployee =
    selectedOrganizationId !== '' &&
    employeeName.trim() !== '' &&
    employeeSetor.trim() !== ''

  async function runAction(action: () => Promise<void>): Promise<void> {
    setIsSaving(true)
    setMessage('')
    try {
      await action()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Operação não concluída.')
    } finally {
      setIsSaving(false)
    }
  }

  async function chooseLogo(): Promise<void> {
    const result = await window.pontoAPI.selectLogoFile()
    if (!result.canceled && result.filePath) setOrganizationLogoPath(result.filePath)
  }

  function surfaceBackendError(result: { error?: string }): boolean {
    if ('error' in result && result.error) {
      setMessage(result.error)
      return true
    }
    return false
  }

  async function saveOrganization(): Promise<void> {
    if (!canSaveOrganization) return
    await runAction(async () => {
      if (editingOrganizationId) {
        const result = await window.pontoAPI.updateOrganization({
          id: editingOrganizationId,
          nome: organizationName,
          logoSourcePath: organizationLogoPath || undefined,
        })
        if (surfaceBackendError(result)) return
        setMessage('Empresa atualizada.')
      } else {
        const result = await window.pontoAPI.createOrganization({
          nome: organizationName,
          logoSourcePath: organizationLogoPath,
        })
        if (surfaceBackendError(result)) return
        setSelectedOrganizationId(result.id)
        setMessage('Empresa cadastrada.')
      }
      await onReload()
      clearOrganizationForm()
    })
  }

  async function removeOrganization(id: string): Promise<void> {
    if (!window.confirm('Excluir esta empresa e todos os funcionários dela?')) return
    await runAction(async () => {
      const result = await window.pontoAPI.deleteOrganization(id)
      if (surfaceBackendError(result)) return
      if (!result.success) {
        setMessage('Não foi possível excluir a empresa.')
        return
      }
      if (selectedOrganizationId === id) setSelectedOrganizationId('')
      await onReload()
      setMessage('Empresa excluída.')
    })
  }

  async function saveEmployee(): Promise<void> {
    if (!canSaveEmployee) return
    await runAction(async () => {
      if (editingEmployeeId) {
        const result = await window.pontoAPI.updateEmployee({
          id: editingEmployeeId,
          nome: employeeName,
          setor: employeeSetor,
        })
        if (surfaceBackendError(result)) return
        setMessage('Funcionário atualizado.')
      } else {
        const result = await window.pontoAPI.createEmployee({
          organizationId: selectedOrganizationId,
          nome: employeeName,
          setor: employeeSetor,
        })
        if (surfaceBackendError(result)) return
        setMessage('Funcionário cadastrado.')
      }
      await onReload()
      clearEmployeeForm()
    })
  }

  async function removeEmployee(id: string): Promise<void> {
    if (!window.confirm('Excluir este funcionário?')) return
    await runAction(async () => {
      const result = await window.pontoAPI.deleteEmployee(id)
      if (surfaceBackendError(result)) return
      if (!result.success) {
        setMessage('Não foi possível excluir o funcionário.')
        return
      }
      await onReload()
      setMessage('Funcionário excluído.')
    })
  }

  async function exportBackup(): Promise<void> {
    await runAction(async () => {
      const result = await window.pontoAPI.exportBackup()
      if (result.canceled) return
      if (!result.success) throw new Error(result.error ?? 'Não foi possível exportar o backup.')
      setMessage(`Backup exportado: ${result.filePath}`)
    })
  }

  async function importBackup(): Promise<void> {
    if (!window.confirm('Importar backup vai substituir os dados atuais. Continuar?')) return
    await runAction(async () => {
      const result = await window.pontoAPI.importBackup()
      if (result.canceled) return
      if (!result.success) throw new Error(result.error ?? 'Não foi possível importar o backup.')
      await onReload()
      clearOrganizationForm()
      clearEmployeeForm()
      setSelectedOrganizationId('')
      setMessage('Backup importado com sucesso.')
    })
  }

  function editOrganization(organization: Organization): void {
    setEditingOrganizationId(organization.id)
    setOrganizationName(organization.nome)
    setOrganizationLogoPath('')
    setSelectedOrganizationId(organization.id)
  }

  function editEmployee(employee: Employee): void {
    setEditingEmployeeId(employee.id)
    setEmployeeName(employee.nome)
    setEmployeeSetor(employee.setor)
    setSelectedOrganizationId(employee.organizationId)
  }

  function clearOrganizationForm(): void {
    setOrganizationName('')
    setOrganizationLogoPath('')
    setEditingOrganizationId(null)
  }

  function clearEmployeeForm(): void {
    setEmployeeName('')
    setEmployeeSetor('')
    setEditingEmployeeId(null)
  }

  return (
    <div style={s.stack}>
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Empresas</h2>
        <div style={s.formGrid}>
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder='Nome da empresa'
            disabled={isSaving}
            style={s.input}
          />
          <button
            type='button'
            onClick={chooseLogo}
            disabled={isSaving}
            style={{ ...s.botao, ...s.botaoSecundario }}
          >
            Escolher logo
          </button>
        </div>
        {organizationLogoPath && (
          <p style={s.pathText}>Logo selecionada: {organizationLogoPath}</p>
        )}
        <div style={s.actions}>
          <button
            type='button'
            onClick={saveOrganization}
            disabled={isSaving || !canSaveOrganization}
            style={{
              ...s.botao,
              ...s.botaoAzul,
              ...(!canSaveOrganization || isSaving ? s.botaoDesabilitado : {}),
            }}
          >
            {editingOrganizationId ? 'Salvar empresa' : 'Cadastrar empresa'}
          </button>
          {editingOrganizationId && (
            <button
              type='button'
              onClick={clearOrganizationForm}
              disabled={isSaving}
              style={{ ...s.botao, ...s.botaoNeutro }}
            >
              Cancelar
            </button>
          )}
        </div>

        <div style={s.list}>
          {data.organizations.map((organization) => (
            <div key={organization.id} style={s.listItem}>
              <button
                type='button'
                onClick={() => setSelectedOrganizationId(organization.id)}
                style={{
                  ...s.listButton,
                  ...(organization.id === selectedOrganizationId
                    ? s.listButtonActive
                    : {}),
                }}
              >
                {organization.nome}
              </button>
              <button
                type='button'
                onClick={() => editOrganization(organization)}
                style={{ ...s.smallButton, ...s.botaoSecundario }}
              >
                Editar
              </button>
              <button
                type='button'
                onClick={() => removeOrganization(organization.id)}
                style={{ ...s.smallButton, ...s.botaoPerigo }}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Funcionários</h2>
        <select
          value={selectedOrganizationId}
          onChange={(event) => {
            setSelectedOrganizationId(event.target.value)
            clearEmployeeForm()
          }}
          style={s.input}
        >
          <option value=''>Selecione uma empresa</option>
          {data.organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.nome}
            </option>
          ))}
        </select>
        <div style={s.formGrid}>
          <input
            value={employeeName}
            onChange={(event) => setEmployeeName(event.target.value)}
            placeholder='Nome do funcionário'
            disabled={isSaving || !selectedOrganization}
            style={s.input}
          />
          <input
            value={employeeSetor}
            onChange={(event) => setEmployeeSetor(event.target.value)}
            placeholder='Setor'
            disabled={isSaving || !selectedOrganization}
            style={s.input}
          />
        </div>
        <div style={s.actions}>
          <button
            type='button'
            onClick={saveEmployee}
            disabled={isSaving || !canSaveEmployee}
            style={{
              ...s.botao,
              ...s.botaoVerde,
              ...(!canSaveEmployee || isSaving ? s.botaoDesabilitado : {}),
            }}
          >
            {editingEmployeeId ? 'Salvar funcionário' : 'Cadastrar funcionário'}
          </button>
          {editingEmployeeId && (
            <button
              type='button'
              onClick={clearEmployeeForm}
              disabled={isSaving}
              style={{ ...s.botao, ...s.botaoNeutro }}
            >
              Cancelar
            </button>
          )}
        </div>

        <div style={s.list}>
          {filteredEmployees.map((employee) => (
            <div key={employee.id} style={s.listItem}>
              <div style={s.employeeText}>
                <strong>{employee.nome}</strong>
                <span>{employee.setor}</span>
              </div>
              <button
                type='button'
                onClick={() => editEmployee(employee)}
                style={{ ...s.smallButton, ...s.botaoSecundario }}
              >
                Editar
              </button>
              <button
                type='button'
                onClick={() => removeEmployee(employee.id)}
                style={{ ...s.smallButton, ...s.botaoPerigo }}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Backup</h2>
        <div style={s.actions}>
          <button
            type='button'
            onClick={exportBackup}
            disabled={isSaving}
            style={{ ...s.botao, ...s.botaoAzul }}
          >
            Exportar backup
          </button>
          <button
            type='button'
            onClick={importBackup}
            disabled={isSaving}
            style={{ ...s.botao, ...s.botaoLaranja }}
          >
            Importar backup
          </button>
        </div>
      </section>

      {message && <div style={s.message}>{message}</div>}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  section: {
    borderTop: '1px solid #d9e6f5',
    paddingTop: '1rem',
  },
  sectionTitle: {
    color: '#082f63',
    fontSize: '1rem',
    marginBottom: '0.75rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.65rem',
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
    minHeight: 40,
  },
  actions: {
    display: 'flex',
    gap: '0.65rem',
    marginTop: '0.75rem',
    flexWrap: 'wrap',
  },
  botao: {
    border: 'none',
    borderRadius: '8px',
    padding: '0.65rem 0.9rem',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  smallButton: {
    border: 'none',
    borderRadius: '7px',
    padding: '0.45rem 0.65rem',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  botaoAzul: { background: '#0b8ff2' },
  botaoVerde: { background: '#15803d' },
  botaoLaranja: { background: '#c2410c' },
  botaoSecundario: { background: '#5f6f84' },
  botaoNeutro: { background: '#64748b' },
  botaoPerigo: { background: '#9f1239' },
  botaoDesabilitado: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.75rem',
  },
  listItem: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: '0.45rem',
    alignItems: 'center',
  },
  listButton: {
    minWidth: 0,
    border: '1px solid #d9e6f5',
    borderRadius: '8px',
    padding: '0.5rem 0.65rem',
    background: '#ffffff',
    color: '#082f63',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 700,
  },
  listButtonActive: {
    borderColor: '#0b8ff2',
    color: '#07346f',
    background: '#f2f8ff',
  },
  employeeText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    color: '#082f63',
    fontSize: '0.85rem',
  },
  pathText: {
    marginTop: '0.45rem',
    color: '#5f6f84',
    fontSize: '0.76rem',
    wordBreak: 'break-all',
  },
  message: {
    padding: '0.75rem 0.9rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '7px',
    color: '#15803d',
    fontSize: '0.85rem',
    wordBreak: 'break-word',
  },
}
