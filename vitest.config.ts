import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'

const root = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Pure-function unit tests run fast. DAL integration tests (which need a
    // real Postgres) live separately and aren't part of the default test run.
  },
  plugins: [
    // Reads `paths` from tsconfig.json — keeps the `@/*` alias in sync with
    // the rest of the codebase.
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // `server-only` is a marker that throws when imported from a Client
      // Component bundle. In Vitest there's no Client/Server split — alias
      // it to an empty module so imports resolve cleanly.
      'server-only': new URL('./tests/stubs/empty.ts', import.meta.url).pathname,
    },
  },
})
