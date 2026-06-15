import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': new URL('./tests/stubs/empty.ts', import.meta.url).pathname,
    },
  },
})
