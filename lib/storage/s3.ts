import 'server-only'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3'
import type { StorageAdapter, PutResult } from './adapter'

function toNodeReadable(
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
): NodeJS.ReadableStream {
  if ('getReader' in stream) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Readable.fromWeb(stream as any)
  }
  return stream
}

export class S3Adapter implements StorageAdapter {
  private client: S3Client
  private bucket: string

  constructor(opts: {
    region: string
    bucket: string
    accessKey: string
    secret: string
    endpoint?: string
  }) {
    this.client = new S3Client({
      region: opts.region,
      ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
      credentials: {
        accessKeyId: opts.accessKey,
        secretAccessKey: opts.secret,
      },
    })
    this.bucket = opts.bucket
  }

  async put(opts: {
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
    contentLength: number
    targetPath: string
  }): Promise<PutResult> {
    const nodeStream = toNodeReadable(opts.stream)

    const chunks: Buffer[] = []
    for await (const chunk of nodeStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as ArrayBuffer))
    }

    const hash = createHash('sha256')
    const body = Buffer.concat(chunks)
    hash.update(body)

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: opts.targetPath,
        Body: body,
        ContentLength: body.length,
      }),
    )

    return {
      key: opts.targetPath,
      sha256: hash.digest('hex'),
      size: BigInt(body.length),
    }
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    let response: GetObjectCommandOutput
    try {
      response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    } catch (err: unknown) {
      const e = err as { name?: string }
      if (e.name === 'NoSuchKey') {
        throw new Error('Object not found')
      }
      throw err
    }

    if (!response.Body) {
      throw new Error('Empty response body from S3')
    }

    return response.Body as NodeJS.ReadableStream
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    } catch {
      // Idempotent
    }
  }
}
