import 'server-only'

/**
 * CSS sanitizer for admin-controlled presentation fields.
 *
 * Threat model: a compromised or insider admin (or an admin who was phished,
 * or any path that bypasses the DAL) could otherwise inject CSS that
 * exfiltrates form values via @font-face src:url() + unicode-range tricks,
 * overrides form[action] / a[href] to redirect submissions, or lays
 * deceptive overlays on top of the portal.
 *
 * Strategy: instead of trying to parse CSS safely (hard), strip every
 * construct that has an exfiltration or redirect primitive:
 *   - @import, @font-face, @font-feature-values, @namespace, @charset
 *   - url(...) in any form (http/https/data:/file:/javascript:/etc.)
 *   - image-set(...)
 *   - expression(...) and any function with a javascript: scheme
 *   - <style> and </style> (prevents breaking out of the injected <style> tag)
 *   - HTML comment markers and CDATA sections
 *   - backslash-escaped sequences that could smuggle the above past filters
 *
 * What survives: real brand styling — selectors, property/value pairs,
 * colors, spacing, layout, animations, media queries. That's the entire
 * legitimate use case for customCss.
 *
 * Output is then capped at a sane length so the column can't be used as a
 * storage-abuse primitive.
 */

const MAX_CSS_LENGTH = 32 * 1024 // 32 KiB is plenty for portal branding

const FORBIDDEN_AT_RULES = [
  '@import',
  '@font-face',
  '@font-feature-values',
  '@namespace',
  '@charset',
  '@document',
]

const FORBIDDEN_TOKEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // url(...) in any form — kills http(s)/data/file/javascript schemes.
  { pattern: /url\s*\(/gi, reason: 'url()' },
  // image-set(...)
  { pattern: /image-set\s*\(/gi, reason: 'image-set()' },
  // expression() (IE legacy but still parsed by some engines)
  { pattern: /expression\s*\(/gi, reason: 'expression()' },
  // javascript:/vbscript: schemes anywhere
  { pattern: /javascript:/gi, reason: 'javascript: scheme' },
  { pattern: /vbscript:/gi, reason: 'vbscript: scheme' },
  // <style> / </style> / <!-- / --> / <![CDATA[ — breakout prevention
  { pattern: /<\/?style[^>]*>/gi, reason: '<style> tag' },
  { pattern: /<!--/g, reason: 'HTML comment open' },
  { pattern: /-->/g, reason: 'HTML comment close' },
  { pattern: /<!\[CDATA\[/gi, reason: 'CDATA section' },
  { pattern: /\]\]>/g, reason: 'CDATA close' },
]

export function sanitizeCustomCss(input: string | null | undefined): string | null {
  if (!input) return null

  // Hard length cap first — defend against storage abuse.
  let s = input.length > MAX_CSS_LENGTH ? input.slice(0, MAX_CSS_LENGTH) : input

  // Strip forbidden @-rules by dropping the entire block they introduce.
  // We scan repeatedly because nested/adjacent blocks exist.
  for (const rule of FORBIDDEN_AT_RULES) {
    s = stripAtRuleBlock(s, rule)
  }

  // Strip every other forbidden token. Replace with a harmless placeholder.
  for (const { pattern } of FORBIDDEN_TOKEN_PATTERNS) {
    s = s.replace(pattern, '/* removed */')
  }

  // Collapse backslash escapes that could reconstruct a forbidden token
  // (e.g. `\75 rl(` decodes to `url(`). Drop the backslash; the literal
  // letters left behind are inert.
  s = s.replace(/\\([0-9a-fA-F]{1,6}\s?|[^0-9a-fA-F])/g, (_m, g1: string) => {
    // Hex escape — decode and re-check; if the decoded char isn't printable
    // ASCII alphanumeric/punct, drop it.
    if (/^[0-9a-fA-F]{1,6}$/.test(g1.trim())) {
      const code = parseInt(g1.trim(), 16)
      if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code)
      return ''
    }
    return g1
  })

  // Re-run the token filter in case decoding reconstructed a forbidden token.
  for (const { pattern } of FORBIDDEN_TOKEN_PATTERNS) {
    s = s.replace(pattern, '/* removed */')
  }

  return s.trim() || null
}

/**
 * Validates a brand color string. Accepts #RGB / #RRGGBB / #RRGGBBAA hex,
 * or an oklch()/rgb()/rgba() function call (the project's tokens are oklch).
 * Anything else (including CSS injection attempts) → null.
 */
export function sanitizeBrandColor(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return s
  // oklch(L C H / A) or rgb/rgba with only numbers, %, spaces, commas, dots, slashes
  if (/^(oklch|rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/-]+\s*\)$/i.test(s)) return s
  return null
}

function stripAtRuleBlock(css: string, rule: string): string {
  // Find each occurrence of `rule` and drop the balanced-brace block that
  // follows it (and the semi-colon form too: `@import url(...);`).
  let out = css
  let idx = out.toLowerCase().indexOf(rule.toLowerCase())
  while (idx !== -1) {
    // Scan forward to either ';' or '{'.
    let i = idx + rule.length
    while (i < out.length && out[i] !== ';' && out[i] !== '{') i++
    if (i >= out.length) {
      // Unterminated — drop to end.
      out = out.slice(0, idx)
      break
    }
    if (out[i] === ';') {
      out = out.slice(0, idx) + out.slice(i + 1)
    } else {
      // out[i] === '{' — find matching close brace.
      let depth = 1
      let j = i + 1
      while (j < out.length && depth > 0) {
        if (out[j] === '{') depth++
        else if (out[j] === '}') depth--
        j++
      }
      out = out.slice(0, idx) + out.slice(j)
    }
    idx = out.toLowerCase().indexOf(rule.toLowerCase())
  }
  return out
}
