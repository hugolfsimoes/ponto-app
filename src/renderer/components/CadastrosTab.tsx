import { JSX, useMemo, useState } from 'react'
import type { Employee, LocalData, Organization, Section } from '../types/electron'

interface CadastrosTabProps {
  data: LocalData
  onReload: () => Promise<void>
}

export function getBackendErrorMessage(result: { error?: string }): string | null {
  if ('error' in result && result.error) return result.error
  return null
}

export function isSectionInUse(
  section: Pick<Section, 'organizationId' | 'nome'>,
  employees: Employee[],
): boolean {
  return employees.some(
    (employee) =>
      employee.organizationId === section.organizationId &&
      employee.setor === section.nome,
  )
}

export function getSectionDeletionWarning(
  section: Pick<Section, 'organizationId' | 'nome'>,
  employees: Employee[],
): string | null {
  if (!isSectionInUse(section, employees)) return null
  return 'Não é possível excluir seção que tenha funcionário cadastrado.'
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
  const [sectionName, setSectionName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [employeeName, setEmployeeName] = useState('')
  const [employeeSetor, setEmployeeSetor] = useState('')
  const [defaultEntrada, setDefaultEntrada] = useState('')
  const [defaultInicioIntervalo, setDefaultInicioIntervalo] = useState('')
  const [defaultFimIntervalo, setDefaultFimIntervalo] = useState('')
  const [defaultSaida, setDefaultSaida] = useState('')
  const [sectionMessage, setSectionMessage] = useState('')
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
  const filteredSections = useMemo(
    () =>
      data.sections.filter(
        (section) => section.organizationId === selectedOrganizationId,
      ),
    [data.sections, selectedOrganizationId],
  )
  const isEditingOrganization = editingOrganizationId !== null
  const isEditingSection = editingSectionId !== null
  const canSaveOrganization =
    organizationName.trim() !== '' &&
    (isEditingOrganization || organizationLogoPath.trim() !== '')
  const canSaveSection =
    selectedOrganizationId !== '' && sectionName.trim() !== ''
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
    const errorMessage = getBackendErrorMessage(result)
    if (errorMessage) {
      setMessage(errorMessage)
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
      clearSectionForm()
      clearEmployeeForm()
      setMessage('Empresa excluída.')
    })
  }

  async function saveSection(): Promise<void> {
    if (!canSaveSection) return
    setSectionMessage('')
    await runAction(async () => {
      if (editingSectionId) {
        const previousSection = data.sections.find(
          (section) => section.id === editingSectionId,
        )
        const result = await window.pontoAPI.updateSection({
          id: editingSectionId,
          nome: sectionName,
        })
        if (surfaceBackendError(result)) return
        await onReload()
        clearSectionForm()
        if (previousSection && employeeSetor === previousSection.nome) {
          setEmployeeSetor(result.nome)
        }
        setMessage('Seção atualizada.')
      } else {
        const result = await window.pontoAPI.createSection({
          organizationId: selectedOrganizationId,
          nome: sectionName,
        })
        if (surfaceBackendError(result)) return
        await onReload()
        clearSectionForm()
        setEmployeeSetor(result.nome)
        setMessage('Seção cadastrada.')
      }
    })
  }

  async function removeSection(section: Section): Promise<void> {
    const warning = getSectionDeletionWarning(section, data.employees)
    if (warning) {
      setSectionMessage(warning)
      window.alert(warning)
      return
    }
    setSectionMessage('')
    if (!window.confirm('Excluir esta seção?')) return
    await runAction(async () => {
      const result = await window.pontoAPI.deleteSection(section.id)
      if (surfaceBackendError(result)) return
      if (!result.success) {
        setMessage('Não foi possível excluir a seção.')
        return
      }
      if (employeeSetor === section.nome) setEmployeeSetor('')
      await onReload()
      setMessage('Seção excluída.')
    })
  }

  async function saveEmployee(): Promise<void> {
    if (!canSaveEmployee) return
    const defaultSchedule = {
      entrada: defaultEntrada,
      inicioIntervalo: defaultInicioIntervalo,
      fimIntervalo: defaultFimIntervalo,
      saida: defaultSaida,
    }
    await runAction(async () => {
      if (editingEmployeeId) {
        const result = await window.pontoAPI.updateEmployee({
          id: editingEmployeeId,
          nome: employeeName,
          setor: employeeSetor,
          defaultSchedule,
        })
        if (surfaceBackendError(result)) return
        setMessage('Funcionário atualizado.')
      } else {
        const result = await window.pontoAPI.createEmployee({
          organizationId: selectedOrganizationId,
          nome: employeeName,
          setor: employeeSetor,
          defaultSchedule,
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
      clearSectionForm()
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

  function editSection(section: Section): void {
    setEditingSectionId(section.id)
    setSectionName(section.nome)
    setSelectedOrganizationId(section.organizationId)
    setSectionMessage('')
  }

  function editEmployee(employee: Employee): void {
    setEditingEmployeeId(employee.id)
    setEmployeeName(employee.nome)
    setEmployeeSetor(employee.setor)
    setDefaultEntrada(employee.defaultSchedule?.entrada ?? '')
    setDefaultInicioIntervalo(employee.defaultSchedule?.inicioIntervalo ?? '')
    setDefaultFimIntervalo(employee.defaultSchedule?.fimIntervalo ?? '')
    setDefaultSaida(employee.defaultSchedule?.saida ?? '')
    setSelectedOrganizationId(employee.organizationId)
  }

  function clearOrganizationForm(): void {
    setOrganizationName('')
    setOrganizationLogoPath('')
    setEditingOrganizationId(null)
  }

  function clearSectionForm(): void {
    setSectionName('')
    setSectionMessage('')
    setEditingSectionId(null)
  }

  function clearEmployeeForm(): void {
    setEmployeeName('')
    setEmployeeSetor('')
    setDefaultEntrada('')
    setDefaultInicioIntervalo('')
    setDefaultFimIntervalo('')
    setDefaultSaida('')
    setEditingEmployeeId(null)
  }

  return (
    <div style={s.stack}>
      <div className='cadastros-layout'>
      <section
        className='cadastros-panel cadastros-empresas-panel'
        style={s.panelSection}
      >
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
                onClick={() => {
                  setSelectedOrganizationId(organization.id)
                  clearSectionForm()
                  clearEmployeeForm()
                }}
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

      <section
        className='cadastros-panel cadastros-funcionarios-panel'
        style={s.panelSection}
      >
        <section style={s.compactSection}>
          <h2 style={s.sectionTitle}>Seções</h2>
          <div style={s.formGrid}>
            <input
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              placeholder='Nome da seção'
              disabled={isSaving || !selectedOrganization}
              style={s.input}
            />
          </div>
          <div style={s.actions}>
            <button
              type='button'
              onClick={saveSection}
              disabled={isSaving || !canSaveSection}
              style={{
                ...s.botao,
                ...s.botaoAzul,
                ...(!canSaveSection || isSaving ? s.botaoDesabilitado : {}),
              }}
            >
              {isEditingSection ? 'Salvar seção' : 'Cadastrar seção'}
            </button>
            {isEditingSection && (
              <button
                type='button'
                onClick={clearSectionForm}
                disabled={isSaving}
                style={{ ...s.botao, ...s.botaoNeutro }}
              >
                Cancelar
              </button>
            )}
          </div>

          <div aria-live='polite'>
            {sectionMessage && <div style={s.inlineWarning}>{sectionMessage}</div>}
          </div>

          <div style={s.list}>
            {filteredSections.map((section) => (
              <div key={section.id} style={s.sectionListItem}>
                <strong style={s.sectionName}>{section.nome}</strong>
                <button
                  type='button'
                  onClick={() => editSection(section)}
                  style={{ ...s.smallButton, ...s.botaoSecundario }}
                >
                  Editar
                </button>
                <button
                  type='button'
                  onClick={() => removeSection(section)}
                  style={{ ...s.smallButton, ...s.botaoPerigo }}
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </section>

        <section style={s.compactSection}>
          <h2 style={s.sectionTitle}>Funcionários</h2>
        <div style={s.formGrid}>
          <input
            value={employeeName}
            onChange={(event) => setEmployeeName(event.target.value)}
            placeholder='Nome do funcionário'
            disabled={isSaving || !selectedOrganization}
            style={s.input}
          />
          <select
            value={employeeSetor}
            onChange={(event) => setEmployeeSetor(event.target.value)}
            disabled={isSaving || !selectedOrganization || filteredSections.length === 0}
            style={s.input}
          >
            <option value=''>Selecione uma seção</option>
            {filteredSections.map((section) => (
              <option key={section.id} value={section.nome}>
                {section.nome}
              </option>
            ))}
          </select>
          <label style={s.fieldLabel}>
            Entrada padrão
            <input
              value={defaultEntrada}
              onChange={(event) => setDefaultEntrada(event.target.value)}
              placeholder='HH:mm'
              disabled={isSaving || !selectedOrganization}
              style={s.input}
            />
          </label>
          <label style={s.fieldLabel}>
            Início intervalo padrão
            <input
              value={defaultInicioIntervalo}
              onChange={(event) => setDefaultInicioIntervalo(event.target.value)}
              placeholder='HH:mm'
              disabled={isSaving || !selectedOrganization}
              style={s.input}
            />
          </label>
          <label style={s.fieldLabel}>
            Fim intervalo padrão
            <input
              value={defaultFimIntervalo}
              onChange={(event) => setDefaultFimIntervalo(event.target.value)}
              placeholder='HH:mm'
              disabled={isSaving || !selectedOrganization}
              style={s.input}
            />
          </label>
          <label style={s.fieldLabel}>
            Saída padrão
            <input
              value={defaultSaida}
              onChange={(event) => setDefaultSaida(event.target.value)}
              placeholder='HH:mm'
              disabled={isSaving || !selectedOrganization}
              style={s.input}
            />
          </label>
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
      </section>
      </div>

      <div className='cadastros-footer'>
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
  compactSection: {
    borderTop: '1px solid #d9e6f5',
    paddingTop: '1rem',
    marginTop: '1rem',
  },
  panelSection: {
    minWidth: 0,
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
  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    color: '#5f6f84',
    fontSize: '0.78rem',
    fontWeight: 700,
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
  sectionListItem: {
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    gap: '0.45rem',
    alignItems: 'center',
  },
  sectionName: {
    minWidth: 0,
    color: '#082f63',
    fontSize: '0.9rem',
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
  inlineWarning: {
    marginTop: '0.75rem',
    padding: '0.65rem 0.8rem',
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '7px',
    color: '#9a3412',
    fontSize: '0.85rem',
    wordBreak: 'break-word',
  },
}
