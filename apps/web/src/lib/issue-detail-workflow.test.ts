import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/(dashboard)/issues/[id]/page.tsx', import.meta.url), 'utf8')

describe('issue detail workflow layout', () => {
  it('uses a triage right rail beside the evidence chain', () => {
    expect(source).toContain('detail.workflow.railTitle')
    expect(source).toContain('detail.evidence.title')
    expect(source).toContain('xl:grid-cols-[minmax(0,1fr)_420px]')
    expect(source.indexOf("t('detail.evidence.title')")).toBeLessThan(source.indexOf("t('detail.workflow.railTitle')"))
  })

  it('keeps advanced grouping actions visually behind normal triage actions', () => {
    expect(source).toContain("title={t('detail.ops.title')}")
    expect(source.indexOf("t('detail.comments.title')")).toBeLessThan(source.indexOf("t('detail.ops.title')"))
  })
})
