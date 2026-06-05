export type SourcemapUploadValidation =
  | { ok: true }
  | { ok: false; messageKey: 'settings.toast.sourcemapReleaseMissing' | 'settings.toast.sourcemapFileMissing' | 'settings.toast.sourcemapInvalidFile' }

export function validateSourcemapUpload(release: string, files: File[]): SourcemapUploadValidation {
  if (!release.trim()) return { ok: false, messageKey: 'settings.toast.sourcemapReleaseMissing' }
  if (files.length === 0) return { ok: false, messageKey: 'settings.toast.sourcemapFileMissing' }
  if (files.some((file) => !isSourcemapFile(file.name))) {
    return { ok: false, messageKey: 'settings.toast.sourcemapInvalidFile' }
  }
  return { ok: true }
}

export function buildSourcemapUploadFormData(files: File[]): FormData {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file, file.name)
  }
  return formData
}

function isSourcemapFile(filename: string): boolean {
  const normalized = filename.toLowerCase()
  return normalized.endsWith('.map') || normalized.endsWith('.json')
}
