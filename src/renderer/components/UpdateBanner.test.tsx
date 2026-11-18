import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UpdateBannerView } from './UpdateBanner'

const noop = (): void => undefined

describe('UpdateBannerView', () => {
  it('renders nothing when there is no update or on error', () => {
    expect(renderToStaticMarkup(<UpdateBannerView status={null} onUpdate={noop} />)).toBe('')
    expect(
      renderToStaticMarkup(
        <UpdateBannerView status={{ state: 'error', message: 'x' }} onUpdate={noop} />,
      ),
    ).toBe('')
  })

  it('shows the version and the Atualizar button when an update is available', () => {
    const html = renderToStaticMarkup(
      <UpdateBannerView status={{ state: 'available', version: '2.6.0' }} onUpdate={noop} />,
    )
    expect(html).toContain('2.6.0')
    expect(html).toContain('Atualizar')
  })

  it('shows progress while downloading', () => {
    const html = renderToStaticMarkup(
      <UpdateBannerView status={{ state: 'downloading', percent: 42 }} onUpdate={noop} />,
    )
    expect(html).toContain('42%')
    expect(html).not.toContain('<button')
  })
})
