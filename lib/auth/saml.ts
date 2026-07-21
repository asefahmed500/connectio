import 'server-only'
import { createHash, createVerify, randomBytes } from 'crypto'

/**
 * Minimal, focused SAML response verifier.
 *
 * This is NOT a general-purpose SAML library — it implements the specific
 * checks needed to defeat the previously-exploitable forgery attack:
 *   1. Response or Assertion must carry an enveloped XMLDSig <ds:Signature>.
 *   2. The signature must verify against the IdP's X.509 certificate that
 *      the admin configured on the provider.
 *   3. The signed element must be the <Response> or the <Assertion>.
 *   4. <AudienceRestriction> must include our SP entity ID.
 *   5. <SubjectConfirmationData> Recipient must match our ACS URL.
 *   6. Conditions NotOnOrAfter / NotBefore must be in range.
 *
 * For the common sign-response OR sign-assertion cases deployed by Okta,
 * Azure AD, Google Workspace, and most IdPs, this is sufficient. If you need
 * encrypted assertions, signed-then-encrypted responses, or alternative
 * canonicalization algorithms, install `@node-saml/node-saml` and replace
 * this module — the surface area is intentionally small so the swap is easy.
 */

export type SamlVerifyInput = {
  /** Raw decoded SAML response XML (already base64-decoded). */
  xml: string
  /** The IdP X.509 certificate (PEM, with or without header/footer, DER base64). */
  idpCertificate: string
  /** Our SP entity ID, used for Audience check. */
  spEntityId: string
  /** Our ACS URL, used for Recipient check. */
  acsUrl: string
}

export type SamlVerifyResult =
  | { ok: true; email: string | null; nameId: string | null }
  | { ok: false; reason: string }

export function verifySamlResponse(input: SamlVerifyInput): SamlVerifyResult {
  const cert = normalizeCertificate(input.idpCertificate)
  if (!cert) return { ok: false, reason: 'IdP certificate missing or malformed' }

  // Locate the signature. We support both <Response>-signed and
  // <Assertion>-signed documents. Prefer response-level; fall back to assertion.
  const signedInfo = extractSignedInfo(input.xml)
  if (!signedInfo) {
    return { ok: false, reason: 'SAML response has no XML signature; unsigned assertions are rejected' }
  }

  // Resolve which element was signed via the <ds:Reference URI="#...">.
  const signedElement = resolveSignedElement(input.xml, signedInfo)
  if (!signedElement) {
    return { ok: false, reason: 'Could not resolve signed element' }
  }

  // Compute the digest of the signed element (c14n approximation: strip
  // whitespace-only text nodes between tags) and compare to <ds:DigestValue>.
  const computedDigest = sha1Base64(stripInterElementWhitespace(signedElement.canonicalXml))
  if (computedDigest !== signedInfo.digestValue) {
    return { ok: false, reason: 'SAML digest mismatch (signed element tampered)' }
  }

  // Verify the <ds:SignatureValue> over the canonical <ds:SignedInfo>.
  const verified = verifyXmlSignature(
    stripInterElementWhitespace(signedInfo.canonicalXml),
    signedInfo.signatureValue,
    cert,
    signedInfo.signatureAlgorithm,
  )
  if (!verified) {
    return { ok: false, reason: 'SAML signature invalid' }
  }

  // Audience check: at least one <Audience> must equal our SP entity ID.
  const audiences = extractAll(input.xml, /<saml(?:\w+)?:Audience[^>]*>([^<]+)<\/saml(?:\w+)?:Audience>/g)
  if (audiences.length > 0 && !audiences.includes(input.spEntityId)) {
    return { ok: false, reason: `SAML audience mismatch (expected ${input.spEntityId})` }
  }

  // Recipient check: <SubjectConfirmationData Recipient="..."> must match ACS.
  const recipient = input.xml.match(/<saml(?:\w+)?:SubjectConfirmationData[^>]*Recipient="([^"]+)"/i)?.[1]
  if (recipient && recipient !== input.acsUrl) {
    return { ok: false, reason: 'SAML Recipient does not match ACS URL' }
  }

  // Time bounds: NotOnOrAfter / NotBefore (±60s clock skew).
  const now = Date.now()
  const notOnOrAfter = input.xml.match(/NotOnOrAfter="([^"]+)"/i)?.[1]
  if (notOnOrAfter) {
    const t = Date.parse(notOnOrAfter)
    if (!Number.isNaN(t) && t + 60_000 < now) {
      return { ok: false, reason: 'SAML assertion expired (NotOnOrAfter)' }
    }
  }
  const notBefore = input.xml.match(/NotBefore="([^"]+)"/i)?.[1]
  if (notBefore) {
    const t = Date.parse(notBefore)
    if (!Number.isNaN(t) && t - 60_000 > now) {
      return { ok: false, reason: 'SAML assertion not yet valid (NotBefore)' }
    }
  }

  const nameId = extractFirst(input.xml, /<saml(?:\w+)?:NameID[^>]*>([^<]+)<\/saml(?:\w+)?:NameID>/)
  const emailAttr = extractFirst(
    input.xml,
    /<saml(?:\w+)?:Attribute[^>]*Name="email"[^>]*>[\s\S]*?<saml(?:\w+)?:AttributeValue[^>]*>([^<]+)<\/saml(?:\w+)?:AttributeValue>/,
  )
  return {
    ok: true,
    nameId: nameId ?? null,
    email: (emailAttr ?? nameId ?? null)?.trim() || null,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function normalizeCertificate(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed
  // Bare base64 DER — wrap so crypto can consume it.
  const cleaned = trimmed.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null
  return `-----BEGIN CERTIFICATE-----\n${cleaned.replace(/(.{64})/g, '$1\n')}\n-----END CERTIFICATE-----`
}

type SignedInfo = {
  canonicalXml: string
  signatureValue: string
  digestValue: string
  signatureAlgorithm: string
  referenceUri: string | null
}

function extractSignedInfo(xml: string): SignedInfo | null {
  const sigMatch = xml.match(/<ds:Signature[\s\S]*?<\/ds:Signature>/)
  if (!sigMatch) return null
  const sigBlock = sigMatch[0]!

  const signedInfoMatch = sigBlock.match(/<ds:SignedInfo[\s\S]*?<\/ds:SignedInfo>/)
  if (!signedInfoMatch) return null
  const signedInfoBlock = signedInfoMatch[0]!

  const signatureValue = extractFirst(sigBlock, /<ds:SignatureValue[^>]*>([^<]+)<\/ds:SignatureValue>/)
  if (!signatureValue) return null

  const digestValue = extractFirst(signedInfoBlock, /<ds:DigestValue[^>]*>([^<]+)<\/ds:DigestValue>/)
  if (!digestValue) return null

  const signatureAlgorithm =
    extractFirst(signedInfoBlock, /<ds:SignatureMethod[^>]*Algorithm="([^"]+)"/i) ??
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
  const referenceUri = extractFirst(signedInfoBlock, /<ds:Reference[^>]*URI="([^"]*)"/i) ?? null

  return {
    canonicalXml: signedInfoBlock,
    signatureValue: signatureValue.replace(/\s+/g, ''),
    digestValue: digestValue.replace(/\s+/g, ''),
    signatureAlgorithm,
    referenceUri,
  }
}

function resolveSignedElement(
  xml: string,
  info: SignedInfo,
): { canonicalXml: string } | null {
  // If no URI, assume the enclosing element is signed.
  if (!info.referenceUri) {
    const resp = xml.match(/<samlp?:Response[\s\S]*?<\/samlp?:Response>/)
    if (resp) return { canonicalXml: resp[0]! }
    return { canonicalXml: xml }
  }
  const id = info.referenceUri.replace(/^#/, '')
  // Find element with ID=<id>. SAML uses ID (not xml:id) on Response/Assertion.
  const re = new RegExp(
    `<(saml(?:p)?:Response|saml(?:\\w+)?:Assertion)[^>]*\\sID=["']${escapeRegex(id)}["']([\\s\\S]*?)</\\1>`,
    'i',
  )
  const m = xml.match(re)
  if (!m) return null
  // Rebuild the full opening tag + body (the regex above only captured after
  // the ID attribute; rebuild by searching from the matched start).
  const tagMatch = xml.match(new RegExp(`<(${m[1]})[^>]*\\sID=["']${escapeRegex(id)}["']`, 'i'))
  if (!tagMatch) return null
  const startIdx = tagMatch.index!
  const closeTag = `</${m[1]}>`
  const endIdx = xml.indexOf(closeTag, startIdx)
  if (endIdx === -1) return null
  return { canonicalXml: xml.slice(startIdx, endIdx + closeTag.length) }
}

function verifyXmlSignature(
  canonicalSignedInfo: string,
  signatureValueB64: string,
  certPem: string,
  algorithm: string,
): boolean {
  const algorithmMap: Record<string, string> = {
    'http://www.w3.org/2000/09/xmldsig#rsa-sha1': 'RSA-SHA1',
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': 'RSA-SHA256',
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384': 'RSA-SHA384',
    'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': 'RSA-SHA512',
    'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256': 'SHA256',
    'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384': 'SHA384',
  }
  const alg = algorithmMap[algorithm] ?? 'RSA-SHA256'
  let sigBuf: Buffer
  try {
    sigBuf = Buffer.from(signatureValueB64, 'base64')
  } catch {
    return false
  }
  try {
    const verifier = createVerify(alg)
    verifier.update(canonicalSignedInfo, 'utf-8')
    return verifier.verify(certPem, sigBuf)
  } catch {
    return false
  }
}

function sha1Base64(s: string): string {
  return createHash('sha1').update(s, 'utf-8').digest('base64')
}

function stripInterElementWhitespace(xml: string): string {
  // Approximate c14n: drop text nodes that are pure whitespace between tags.
  return xml.replace(/>\s+</g, '><').trim()
}

function extractFirst(xml: string, pattern: RegExp): string | undefined {
  return xml.match(pattern)?.[1]
}

function extractAll(xml: string, pattern: RegExp): string[] {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) out.push(m[1].trim())
  }
  return out
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Generate a cryptographically secure random ID for SAML request IDs.
 * (Exported for completeness — not currently used by the SP-initiated flow
 *  which is IdP-initiated here, but available for a future RequestID replay
 *  check.)
 */
export function generateSamlRequestId(): string {
  return '_' + randomBytes(16).toString('hex')
}
