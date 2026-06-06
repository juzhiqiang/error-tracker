import { afterEach, describe, expect, it, mock } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectSourcemapFiles, parseUploadArgs, sha256, uploadSourcemaps } from './sourcemaps'

let tmpDirs: string[] = []
const originalFetch = globalThis.fetch

afterEach(async () => {
  globalThis.fetch = originalFetch
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  tmpDirs = []
})

describe('sourcemap cli', () => {
  it('parses upload arguments', () => {
    expect(
      parseUploadArgs([
        'upload',
        '--api-url',
        'http://localhost:3002',
        '--project-id',
        'project-1',
        '--token',
        'token-1',
        '--release',
        'web@2.8.1',
        '--dist',
        'dist',
      ]),
    ).toEqual({
      apiUrl: 'http://localhost:3002',
      projectId: 'project-1',
      token: 'token-1',
      release: 'web@2.8.1',
      dist: 'dist',
    })
  })

  it('collects only sourcemap files', () => {
    const files = collectSourcemapFiles(['app.js', 'app.js.map', 'route.json'])
    expect(files).toEqual(['app.js.map', 'route.json'])
  })

  it('computes sha256 checksums', () => {
    expect(sha256(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('uploads sourcemaps with token and checksums', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'error-tracker-cli-'))
    tmpDirs.push(dir)
    await writeFile(join(dir, 'app.js'), 'console.log("skip")')
    await writeFile(join(dir, 'app.js.map'), '{}')
    await writeFile(join(dir, 'route.json'), '{"version":3}')

    const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({ uploaded: 2, files: [{ filename: 'app.js.map' }, { filename: 'route.json' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    globalThis.fetch = fetchMock as never

    const result = await uploadSourcemaps({
      apiUrl: 'http://localhost:3002',
      projectId: 'project-1',
      token: 'token-1',
      release: 'web@2.8.1',
      dist: dir,
    })

    expect(result.uploaded).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://localhost:3002/api/sourcemaps/project-1/web%402.8.1/ci')
    expect(new Headers(init?.headers).get('x-error-tracker-token')).toBe('token-1')
    const form = init?.body as FormData
    expect(form.getAll('files')).toHaveLength(2)
    expect(String(form.get('checksums'))).toContain('app.js.map')
  })
})
