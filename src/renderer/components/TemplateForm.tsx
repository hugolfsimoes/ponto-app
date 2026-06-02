import { JSX, useEffect, useState } from 'react'
import type { LocalData } from '../types/electron'
import logoProtmax from '../../../resources/protmax.jpeg'
import { CadastrosTab } from './CadastrosTab'
import { PontoTab } from './PontoTab'
import { AppTab, Tabs } from './Tabs'

export function TemplateForm(): JSX.Element {
  const [activeTab, setActiveTab] = useState<AppTab>('ponto')
  const [localData, setLocalData] = useState<LocalData>({
    version: 1,
    organizations: [],
    employees: [],
  })
  const [loadError, setLoadError] = useState('')

  async function reloadLocalData(): Promise<void> {
    try {
      const data = await window.pontoAPI.loadLocalData()
      setLocalData(data)
      setLoadError('')
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Não foi possível carregar os cadastros.',
      )
    }
  }

  useEffect(() => {
    void reloadLocalData()
  }, [])

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.header}>
          <img src={logoProtmax} alt='PROTMAX' style={s.logo} />
          <div style={s.headerText}>
            <h1 style={s.titulo}>PROTMAX</h1>
          </div>
        </div>

        <Tabs activeTab={activeTab} onChange={setActiveTab} />

        {loadError && <div style={s.infoErro}>{loadError}</div>}

        {activeTab === 'ponto' ? (
          <PontoTab
            organizations={localData.organizations}
            employees={localData.employees}
          />
        ) : (
          <CadastrosTab data={localData} onReload={reloadLocalData} />
        )}
      </div>
    </div>
  )
}

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
    maxWidth: '520px',
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
  infoErro: {
    marginBottom: '1rem',
    padding: '0.75rem 0.9rem',
    background: '#2b1414',
    border: '1px solid #5c1f1f',
    borderRadius: '7px',
    color: '#f87171',
    fontSize: '0.85rem',
  },
}
