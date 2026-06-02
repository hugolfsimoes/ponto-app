import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('main window startup', () => {
  it('maximizes the main window before showing it', () => {
    const source = readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf-8')

    expect(source).toMatch(/mainWindow\.maximize\(\)[\s\S]*mainWindow\.show\(\)/)
  })
})
