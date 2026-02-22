// Rewrite incoming deep links BEFORE Expo Router matches routes.
// Export redirectSystemPath so savr:///password-reset and savr://password-reset
// map to /password-reset and the app opens on the reset screen (no "Unmatched Route").
// See: https://docs.expo.dev/router/advanced/native-intent/
//
// Return only pathname (no hash/query) so getStateFromPath matches; the target
// screen (e.g. password-reset) still gets the full URL via Linking.getInitialURL().

function rewritePath(path: string): string {
  if (!path || typeof path !== 'string') return path
  const lower = path.toLowerCase()

  // Full URL forms: savr://password-reset, savr:///password-reset, savr://password-reset#...
  if (lower.includes('password-reset')) return '/password-reset'
  if (lower.includes('email-verification')) return '/email-verification'

  // Parsed path forms: Expo may pass path-only (e.g. "password-reset" when host was password-reset, or "//password-reset")
  const afterScheme = path.replace(/^[^:]+:\/\//i, '').replace(/^\/+/, '')
  const segment = afterScheme.split(/[/?#]/)[0]?.toLowerCase()
  if (segment === 'password-reset') return '/password-reset'
  if (segment === 'email-verification') return '/email-verification'

  return path
}

export function redirectSystemPath(options: { path: string; initial: boolean }): string | Promise<string> {
  const { path, initial } = options
  try {
    if (!initial) return path
    return rewritePath(path)
  } catch {
    return path
  }
}
