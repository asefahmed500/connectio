import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Integration tests share a single connectio_test database and truncate
    // between tests; running files in parallel would have them wipe each
    // other's data. Serialize the whole suite (it's small).
    fileParallelism: false,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': new URL('./tests/stubs/empty.ts', import.meta.url).pathname,
    },
  },
})
