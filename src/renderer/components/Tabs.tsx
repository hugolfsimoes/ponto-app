import type { JSX } from 'react'

export type AppTab = 'ponto' | 'cadastros'

interface TabsProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export function Tabs({ activeTab, onChange }: TabsProps): JSX.Element {
  return (
    <div className='tabs' role='tablist' aria-label='Navegação principal'>
      <button
        type='button'
        className={activeTab === 'ponto' ? 'tab active' : 'tab'}
        onClick={() => onChange('ponto')}
      >
        Ponto
      </button>
      <button
        type='button'
        className={activeTab === 'cadastros' ? 'tab active' : 'tab'}
        onClick={() => onChange('cadastros')}
      >
        Cadastros
      </button>
    </div>
  )
}
