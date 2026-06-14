// Global test setup. Loads env vars the auth modules read at module-eval time.
// NOTE: Vitest already sets process.env.NODE_ENV='test' before this runs.

process.env.AUTH_JWT_SECRET ??= 'test-secret-32-chars-min-here-xxxxxx'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/connectio_test?schema=public'
