import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['backend/**/*.ts'],
      exclude: ['backend/**/*.test.ts', 'backend/types/**'],
    },
  },
})
