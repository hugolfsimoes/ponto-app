import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('main window startup', () => {
  it('maximizes the main window before showing it', () => {
    const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf-8')

    expect(source).toMatch(/mainWindow\.maximize\(\)[\s\S]*mainWindow\.show\(\)/)
  })

  it('creates the main window using the current screen work area instead of a small fixed size', () => {
    const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf-8')

    expect(source).toContain('screen.getPrimaryDisplay().workAreaSize')
    expect(source).toMatch(/width:\s*workAreaSize\.width/)
    expect(source).toMatch(/height:\s*workAreaSize\.height/)
    expect(source).not.toMatch(/width:\s*560/)
    expect(source).not.toMatch(/height:\s*700/)
  })
})
