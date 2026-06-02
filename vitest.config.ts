import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['backend/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'backend/**/*.test.ts',
        'backend/types/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
})
