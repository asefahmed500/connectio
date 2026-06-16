import 'server-only'

// Allow-list of (mime, extension, magic-number-prefix) tuples.
// Magic numbers are byte prefixes; we check the first N bytes of the stream.
// Anything not on this list is rejected at upload time.

interface AllowedType {
  mime: string
  exts: string[]
  magic: number[] // bytes to match at offset 0
}

const ALLOWED: AllowedType[] = [
  { mime: 'application/pdf', exts: ['pdf'], magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mime: 'image/png', exts: ['png'], magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', exts: ['jpg', 'jpeg'], magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', exts: ['gif'], magic: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  {
    mime: 'image/webp',
    exts: ['webp'],
    // RIFF....WEBP — check the first 4 and bytes 8-11.
    magic: [0x52, 0x49, 0x46, 0x46],
  },
  // ZIP-based formats (Office docs + zip itself). Distinguished by extension
  // since the magic is shared.
  { mime: 'application/zip', exts: ['zip'], magic: [0x50, 0x4b, 0x03, 0x04] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    exts: ['docx'],
    magic: [0x50, 0x4b, 0x03, 0x04],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    exts: ['xlsx'],
    magic: [0x50, 0x4b, 0x03, 0x04],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    exts: ['pptx'],
    magic: [0x50, 0x4b, 0x03, 0x04],
  },
  // Plain text + markdown: no reliable magic number — accepted on extension +
  // Content-Type alone. Lower-risk because they're text-only (no embedded
  // scripts in the file format itself; we strip <script> at render time).
]

const TEXT_TYPES = new Set(['text/plain', 'text/markdown'])
const TEXT_EXTS = new Set(['txt', 'md', 'markdown'])

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024)

export function isAllowedMime(mime: string): boolean {
  return ALLOWED.some((t) => t.mime === mime) || TEXT_TYPES.has(mime)
}

export function isAllowedExtension(ext: string): boolean {
  const lower = ext.toLowerCase().replace(/^\./, '')
  return ALLOWED.some((t) => t.exts.includes(lower)) || TEXT_EXTS.has(lower)
}

/**
 * Verify the leading bytes match the magic number for the declared MIME type.
 * Call after reading the first chunk of the stream. Returns false if the
 * bytes don't match (or if no magic is registered for the type).
 */
export function matchesMagic(mime: string, leading: Uint8Array): boolean {
  if (TEXT_TYPES.has(mime)) return true // no magic for text
  const def = ALLOWED.find((t) => t.mime === mime)
  if (!def) return false
  if (leading.length < def.magic.length) return false
  for (let i = 0; i < def.magic.length; i++) {
    if (leading[i] !== def.magic[i]) return false
  }
  // Special case: WEBP needs "WEBP" at offset 8.
  if (mime === 'image/webp' && leading.length >= 12) {
    if (
      leading[8] !== 0x57 ||
      leading[9] !== 0x45 ||
      leading[10] !== 0x42 ||
      leading[11] !== 0x50
    ) {
      return false
    }
  }
  return true
}

/**
 * Extracts the (lowercased, dot-stripped) file extension from a filename, or
 * '' if it has none. Shared by the upload route (extension allow-list check)
 * and guessExtension so the two never disagree on what counts as "the ext".
 */
export function extensionOf(filename: string): string {
  return filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
}

export function guessExtension(mime: string, originalName: string): string {
  const ext = extensionOf(originalName)
  if (ext && isAllowedExtension(ext)) {
    return '.' + ext
  }
  const def = ALLOWED.find((t) => t.mime === mime)
  if (def) return '.' + def.exts[0]
  if (mime === 'text/markdown') return '.md'
  if (mime === 'text/plain') return '.txt'
  return ''
}

/**
 * Strip path components and dangerous characters from a client-supplied
 * filename. The result is what gets stored in `File.originalName` and
 * returned in Content-Disposition headers.
 */
export function sanitizeFilename(name: string): string {
  const basename = name.replace(/\\/g, '/').split('/').pop() ?? name
  const trimmed = basename.replace(/^\.+/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
  return trimmed.slice(0, 255) || 'unnamed'
}
