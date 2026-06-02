import { describe, expect, it } from 'vitest'
import { getBackendErrorMessage } from './CadastrosTab'

describe('getBackendErrorMessage', () => {
  it('returns backend error text when a CRUD result includes an error', () => {
    expect(getBackendErrorMessage({ error: 'Logo inválida.' })).toBe(
      'Logo inválida.',
    )
  })

  it('returns null when a CRUD result has no backend error', () => {
    expect(getBackendErrorMessage({ success: true })).toBeNull()
  })
})
