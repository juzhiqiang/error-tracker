import { describe, expect, it } from 'bun:test'
import { buildSourcemapUploadFormData, validateSourcemapUpload } from './sourcemap-upload'

describe('sourcemap upload helpers', () => {
  it('requires a release and at least one sourcemap file', () => {
    const file = new File(['{}'], 'app.js.map', { type: 'application/json' })

    expect(validateSourcemapUpload('', [file])).toEqual({
      ok: false,
      messageKey: 'settings.toast.sourcemapReleaseMissing',
    })
    expect(validateSourcemapUpload('web@2.8.1', [])).toEqual({
      ok: false,
      messageKey: 'settings.toast.sourcemapFileMissing',
    })
  })

  it('accepts map and json files but rejects unrelated artifacts', () => {
    expect(validateSourcemapUpload('web@2.8.1', [new File(['{}'], 'app.js.map')])).toEqual({ ok: true })
    expect(validateSourcemapUpload('web@2.8.1', [new File(['{}'], 'index.json')])).toEqual({ ok: true })
    expect(validateSourcemapUpload('web@2.8.1', [new File([''], 'bundle.js')])).toEqual({
      ok: false,
      messageKey: 'settings.toast.sourcemapInvalidFile',
    })
  })

  it('keeps selected files under the files field expected by the API', () => {
    const files = [
      new File(['{}'], 'app.js.map', { type: 'application/json' }),
      new File(['{}'], 'vendor.js.map', { type: 'application/json' }),
    ]

    const formData = buildSourcemapUploadFormData(files)

    expect(formData.getAll('files')).toEqual(files)
  })
})
