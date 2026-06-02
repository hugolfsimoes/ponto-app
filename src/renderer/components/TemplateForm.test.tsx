import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tabs } from './Tabs'
import { TemplateForm } from './TemplateForm'

describe('TemplateForm branding', () => {
  it('uses the Ponto App shell branding instead of the fixed PROTMAX header', () => {
    const html = renderToStaticMarkup(<TemplateForm />)

    expect(html).toContain('Ponto App')
    expect(html).toContain('Folha de ponto por empresa e funcionário')
    expect(html).not.toContain('PROTMAX')
  })
})

describe('Tabs', () => {
  it('marks the active tab with the branded active class', () => {
    const html = renderToStaticMarkup(
      <Tabs activeTab='cadastros' onChange={() => undefined} />,
    )

    expect(html).toContain('role="tablist"')
    expect(html).toContain('class="tab active"')
    expect(html).toContain('Cadastros')
  })
})
