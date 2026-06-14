// Runs once per server instance at boot, before any request is served.
// Validates env vars so the app refuses to start with bad config rather than
// failing mid-request. See docs/12-env-and-config.md.

export async function register() {
  // Dynamic import so the env module (which throws on bad config) is only
  // evaluated in the Node runtime — not bundled into edge builds.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('./lib/auth/env')
    getEnv()
  }
}
