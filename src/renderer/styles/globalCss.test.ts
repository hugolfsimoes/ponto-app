import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('global app layout styles', () => {
  it('uses a fluid app shell width with a desktop cap', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/renderer/styles/global.css'),
      'utf-8',
    )

    expect(source).toMatch(/\.app-shell\s*{[\s\S]*width:\s*min\(96vw,\s*1280px\)/)
    expect(source).not.toMatch(/\.app-shell\s*{[\s\S]*max-width:\s*980px/)
  })
})
