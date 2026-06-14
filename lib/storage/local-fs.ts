import 'server-only'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import type { StorageAdapter, PutResult } from './adapter'

// Local filesystem adapter. Used in dev. The S3 adapter (production) lives in
// lib/storage/s3.ts (added when production deployment is wired up).
//
// Files go under <root>/clients/<clientId>/... mirroring the storage key
// layout so a recursive directory delete is equivalent to a key-prefix delete.

export class LocalFsAdapter implements StorageAdapter {
  private readonly root: string

  constructor(opts: { root: string }) {
    // Resolve once so subsequent path joins can't escape the root via "../".
    this.root = resolve(opts.root)
  }

  async put(opts: {
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
    contentLength: number
    targetPath: string
  }): Promise<PutResult> {
    const fullPath = this.resolveSafe(opts.targetPath)
    await mkdir(dirname(fullPath), { recursive: true })

    const hash = createHash('sha256')
    let size = BigInt(0)
    const sink = createWriteStream(fullPath)

    // Normalize web or Node stream into a Node Readable.
    const nodeStream =
      opts.stream instanceof ReadableStream
        ? Readable.fromWeb(opts.stream as unknown as import('stream/web').ReadableStream<Uint8Array>)
        : (opts.stream as NodeJS.ReadableStream)

    await new Promise<void>((resolveP, rejectP) => {
      const interleaved = new Readable({
        read() {},
      })
      nodeStream
        .on('data', (chunk: Buffer) => {
          hash.update(chunk)
          size += BigInt(chunk.length)
          interleaved.push(chunk)
        })
        .on('end', () => interleaved.push(null))
        .on('error', (err) => {
          rejectP(err)
          interleaved.destroy(err)
        })
      interleaved.pipe(sink).on('error', rejectP).on('finish', resolveP)
    })

    return { key: opts.targetPath, sha256: hash.digest('hex'), size }
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const fullPath = this.resolveSafe(key)
    // Throws if missing — the route handler maps that to 404.
    await stat(fullPath)
    return createReadStream(fullPath)
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveSafe(key)
    try {
      await rm(fullPath, { force: true })
    } catch {
      // Idempotent per the interface contract.
    }
  }

  /**
   * Resolves `key` under `this.root`, rejecting path-traversal attempts.
   * Keys look like `clients/<cuid>/submissions/<cuid>/<fileid>.ext`.
   */
  private resolveSafe(key: string): string {
    if (!key.startsWith('clients/')) {
      throw new Error(`Invalid storage key: ${key}`)
    }
    const resolved = resolve(join(this.root, key))
    if (
      resolved !== this.root &&
      !resolved.startsWith(this.root + '\\') &&
      !resolved.startsWith(this.root + '/')
    ) {
      throw new Error(`Storage key escapes root: ${key}`)
    }
    return resolved
  }
}
