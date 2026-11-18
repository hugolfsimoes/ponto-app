import { CSSProperties, JSX, useEffect, useState } from 'react'
import type { UpdateStatus } from '../types/electron'

export function UpdateBannerView({
  status,
  onUpdate,
}: {
  status: UpdateStatus | null
  onUpdate: () => void
}): JSX.Element | null {
  if (!status || status.state === 'error') return null

  return (
    <div style={s.banner} role='status'>
      {status.state === 'available' && (
        <>
          <span>Versão {status.version} disponível.</span>
          <button type='button' onClick={onUpdate} style={s.botao}>
            Atualizar
          </button>
        </>
      )}
      {status.state === 'downloading' && (
        <span>Baixando atualização… {status.percent}%</span>
      )}
      {status.state === 'installing' && (
        <span>Instalando atualização. O app vai reiniciar…</span>
      )}
    </div>
  )
}

export function UpdateBanner(): JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => window.pontoAPI.onUpdateStatus(setStatus), [])

  return (
    <UpdateBannerView
      status={status}
      onUpdate={() => {
        setStatus({ state: 'downloading', percent: 0 })
        void window.pontoAPI.downloadUpdate()
      }}
    />
  )
}

const s: Record<string, CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1rem',
    padding: '0.6rem 0.9rem',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '7px',
    color: '#082f63',
    fontSize: '0.88rem',
  },
  botao: {
    background: '#0b5cad',
    color: '#ffffff',
    border: 'none',
    borderRadius: '7px',
    padding: '0.4rem 1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
