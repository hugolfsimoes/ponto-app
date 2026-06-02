import type { CSSProperties, JSX } from 'react'

export type AppTab = 'ponto' | 'cadastros'

interface TabsProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

export function Tabs({ activeTab, onChange }: TabsProps): JSX.Element {
  return (
    <div style={styles.tabs}>
      <button
        type='button'
        onClick={() => onChange('ponto')}
        disabled={activeTab === 'ponto'}
        style={{
          ...styles.tab,
          ...(activeTab === 'ponto' ? styles.tabActive : {}),
        }}
      >
        Ponto
      </button>
      <button
        type='button'
        onClick={() => onChange('cadastros')}
        disabled={activeTab === 'cadastros'}
        style={{
          ...styles.tab,
          ...(activeTab === 'cadastros' ? styles.tabActive : {}),
        }}
      >
        Cadastros
      </button>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  tabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    border: '1px solid #505050',
    borderRadius: 8,
    background: '#2a2a2a',
    color: '#f0f0f0',
    padding: '0.65rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    background: '#2563a8',
    borderColor: '#2563a8',
    cursor: 'default',
  },
}
