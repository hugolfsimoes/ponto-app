import { CSSProperties, JSX, useEffect, useState } from 'react'
import type { LocalData } from '../types/electron'
import pontoAppLogo from '../../assets/img/appImage.png'
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
    <div className='app-shell'>
      <div className='app-panel'>
        <header className='app-header'>
          <img src={pontoAppLogo} alt='Ponto App' className='app-logo' />
          <div>
            <h1>Ponto App</h1>
            <p>Folha de ponto por empresa e funcionário</p>
          </div>
        </header>

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

const s: Record<string, CSSProperties> = {
  infoErro: {
    marginBottom: '1rem',
    padding: '0.75rem 0.9rem',
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '7px',
    color: '#be123c',
    fontSize: '0.85rem',
  },
}
