import { describe, expect, it } from 'vitest'
import {
  isAllowedExtension,
  isAllowedMime,
  extensionOf,
  matchesMagic,
  guessExtension,
  sanitizeFilename,
} from '@/lib/uploads/validate'

describe('isAllowedExtension', () => {
  it('accepts allowed bare extensions', () => {
    expect(isAllowedExtension('pdf')).toBe(true)
    expect(isAllowedExtension('jpg')).toBe(true)
    expect(isAllowedExtension('jpeg')).toBe(true)
    expect(isAllowedExtension('png')).toBe(true)
    expect(isAllowedExtension('docx')).toBe(true)
    expect(isAllowedExtension('zip')).toBe(true)
  })

  it('accepts text extensions', () => {
    expect(isAllowedExtension('md')).toBe(true)
    expect(isAllowedExtension('txt')).toBe(true)
  })

  it('rejects disallowed extensions', () => {
    expect(isAllowedExtension('exe')).toBe(false)
    expect(isAllowedExtension('sh')).toBe(false)
    expect(isAllowedExtension('svg')).toBe(false)
    expect(isAllowedExtension('html')).toBe(false)
  })

  it('normalizes case and a leading dot', () => {
    expect(isAllowedExtension('PDF')).toBe(true)
    expect(isAllowedExtension('.pdf')).toBe(true)
  })

  it('rejects the empty string', () => {
    expect(isAllowedExtension('')).toBe(false)
  })
})

describe('extensionOf', () => {
  it('extracts the trailing extension, lowercased', () => {
    expect(extensionOf('report.pdf')).toBe('pdf')
    expect(extensionOf('photo.JPG')).toBe('jpg')
    expect(extensionOf('archive.tar.gz')).toBe('gz')
    expect(extensionOf('a.b.c')).toBe('c')
  })

  it('returns empty string when there is no extension', () => {
    expect(extensionOf('noext')).toBe('')
    expect(extensionOf('trailing.')).toBe('')
    expect(extensionOf('')).toBe('')
  })
})

// Regression for the bug that shipped: the upload route passed the FULL
// filename to isAllowedExtension, which compared it verbatim against the
// extension allow-list and therefore rejected every upload. The route now
// composes isAllowedExtension(extensionOf(file.name)); pin that composition.
describe('upload extension check composition (Bug 1 regression)', () => {
  it('accepts a normal filename the way the route now checks it', () => {
    expect(isAllowedExtension(extensionOf('report.pdf'))).toBe(true)
    expect(isAllowedExtension(extensionOf('photo.PNG'))).toBe(true)
    expect(isAllowedExtension(extensionOf('Budget.Q1.xlsx'))).toBe(true)
  })

  it('still rejects disallowed filenames', () => {
    expect(isAllowedExtension(extensionOf('malware.exe'))).toBe(false)
    expect(isAllowedExtension(extensionOf('payload.svg'))).toBe(false)
    expect(isAllowedExtension(extensionOf('noextension'))).toBe(false)
  })

  it('would have FAILED before the fix (full filename passed directly)', () => {
    // Documents the old buggy behaviour so it can't silently return.
    expect(isAllowedExtension('report.pdf')).toBe(false)
  })
})

describe('matchesMagic', () => {
  it('accepts bytes that match the declared type', () => {
    // %PDF-
    expect(matchesMagic('application/pdf', Uint8Array.of(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe(true)
    // PNG signature
    expect(
      matchesMagic('image/png', Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe(true)
  })

  it('rejects a spoofed file (PNG bytes declared as PDF)', () => {
    const pngBytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    expect(matchesMagic('application/pdf', pngBytes)).toBe(false)
  })

  it('rejects when too few bytes are provided', () => {
    expect(matchesMagic('application/pdf', Uint8Array.of(0x25, 0x50))).toBe(false)
  })

  it('always passes for text types (no magic number)', () => {
    expect(matchesMagic('text/plain', Uint8Array.of())).toBe(true)
    expect(matchesMagic('text/markdown', Uint8Array.of(0x23, 0x20))).toBe(true) // "# "
  })
})

describe('sanitizeFilename', () => {
  it('strips path components (path-traversal guard)', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFilename('C:\\Windows\\evil.dll')).toBe('evil.dll')
  })

  it('replaces filesystem-dangerous characters', () => {
    expect(sanitizeFilename('a<b>c')).toBe('a_b_c')
  })

  it('preserves a normal filename', () => {
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf')
  })

  it('falls back to a default name when nothing is left', () => {
    expect(sanitizeFilename('')).toBe('unnamed')
    expect(sanitizeFilename('   ')).toBe('unnamed')
  })
})

describe('guessExtension', () => {
  it('uses the name extension when allowed', () => {
    expect(guessExtension('image/png', 'photo.png')).toBe('.png')
  })

  it('derives the extension from MIME when the name lacks one', () => {
    expect(guessExtension('application/pdf', 'no-extension-here')).toBe('.pdf')
  })

  it('maps markdown/plain MIME to .md/.txt', () => {
    expect(guessExtension('text/markdown', 'readme')).toBe('.md')
    expect(guessExtension('text/plain', 'notes')).toBe('.txt')
  })
})

describe('isAllowedMime', () => {
  it('accepts allow-listed MIME types and text types', () => {
    expect(isAllowedMime('application/pdf')).toBe(true)
    expect(isAllowedMime('image/png')).toBe(true)
    expect(isAllowedMime('text/plain')).toBe(true)
  })

  it('rejects disallowed MIME types', () => {
    expect(isAllowedMime('application/x-msdownload')).toBe(false) // .exe
    expect(isAllowedMime('image/svg+xml')).toBe(false)
  })
})
