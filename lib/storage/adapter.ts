// Storage abstraction. Local FS in dev, S3-compatible (R2/Vercel Blob/S3) in prod.
// See docs/07-uploads.md.

export interface PutResult {
  key: string
  sha256: string
  size: bigint
}

export interface StorageAdapter {
  /**
   * Stream a file into storage. Implementations MUST compute sha256 + size
   * as they write, and reject the put if either doesn't match expectations.
   */
  put(opts: {
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
    contentLength: number
    targetPath: string
  }): Promise<PutResult>

  /**
   * Returns a Node Readable stream for the object. (Presigned URLs are a
   * separate concern; the route handler decides whether to stream or redirect.)
   */
  get(key: string): Promise<NodeJS.ReadableStream>

  /** Delete by key. Idempotent — no error if the object doesn't exist. */
  delete(key: string): Promise<void>
}
