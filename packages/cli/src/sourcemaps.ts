import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

export interface UploadSourcemapOptions {
  apiUrl: string
  projectId: string
  token: string
  release: string
  dist: string
}

export interface UploadedSourcemapFile {
  filename: string
  checksum: string
  status: 'created' | 'updated'
}

export interface UploadSourcemapResult {
  uploaded: number
  files: UploadedSourcemapFile[]
}

export function parseUploadArgs(args: string[]): UploadSourcemapOptions {
  const normalized = args[0] === 'sourcemaps' ? args.slice(1) : args
  if (normalized[0] !== 'upload') {
    throw new Error('Usage: error-tracker sourcemaps upload --api-url <url> --project-id <id> --token <token> --release <release> --dist <dir>')
  }

  const values = new Map<string, string>()
  for (let index = 1; index < normalized.length; index += 2) {
    const key = normalized[index]
    const value = normalized[index + 1]
    if (!key?.startsWith('--') || !value) {
      throw new Error(`Invalid argument near ${key ?? '<empty>'}`)
    }
    values.set(key.slice(2), value)
  }

  return {
    apiUrl: required(values, 'api-url'),
    projectId: required(values, 'project-id'),
    token: required(values, 'token'),
    release: required(values, 'release'),
    dist: required(values, 'dist'),
  }
}

export function collectSourcemapFiles(files: string[]): string[] {
  return files.filter((file) => file.endsWith('.map') || file.endsWith('.json'))
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function uploadSourcemaps(options: UploadSourcemapOptions): Promise<UploadSourcemapResult> {
  const distRoot = resolve(options.dist)
  const files = collectSourcemapFiles(await listFiles(distRoot)).sort()
  if (files.length === 0) {
    throw new Error(`No sourcemap files found in ${options.dist}`)
  }

  const formData = new FormData()
  const checksums: Array<{ filename: string; checksum: string }> = []

  for (const file of files) {
    const buffer = await readFile(file)
    const filename = relative(distRoot, file).replace(/\\/g, '/')
    const checksum = sha256(buffer)
    checksums.push({ filename, checksum })
    formData.append('files', new File([new Uint8Array(buffer)], filename, { type: 'application/json' }))
  }
  formData.append('checksums', JSON.stringify(checksums))

  const response = await fetch(
    `${options.apiUrl.replace(/\/$/, '')}/api/sourcemaps/${encodeURIComponent(options.projectId)}/${encodeURIComponent(options.release)}/ci`,
    {
      method: 'POST',
      headers: { 'x-error-tracker-token': options.token },
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error(`Sourcemap upload failed with ${response.status}: ${await response.text()}`)
  }

  return (await response.json()) as UploadSourcemapResult
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(dir, entry.name)
      return entry.isDirectory() ? listFiles(path) : [path]
    }),
  )
  return nested.flat()
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key)
  if (!value) {
    throw new Error(`Missing required argument --${key}`)
  }
  return value
}
