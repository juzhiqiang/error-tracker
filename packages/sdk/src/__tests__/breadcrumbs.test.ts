import { describe, it, expect } from 'bun:test'
import { BreadcrumbManager } from '../core/breadcrumbs'

describe('BreadcrumbManager', () => {
  it('stores breadcrumbs', () => {
    const mgr = new BreadcrumbManager(5)
    mgr.add({ timestamp: 1, type: 'ui.click', message: 'click' })
    expect(mgr.getAll()).toHaveLength(1)
  })

  it('caps at maxSize (circular buffer)', () => {
    const mgr = new BreadcrumbManager(3)
    for (let i = 0; i < 5; i++) {
      mgr.add({ timestamp: i, type: 'console', message: `msg${i}` })
    }
    const items = mgr.getAll()
    expect(items).toHaveLength(3)
    expect(items[0].message).toBe('msg2')
    expect(items[2].message).toBe('msg4')
  })

  it('clear resets the buffer', () => {
    const mgr = new BreadcrumbManager(5)
    mgr.add({ timestamp: 1, type: 'navigation' })
    mgr.clear()
    expect(mgr.getAll()).toHaveLength(0)
  })
})
