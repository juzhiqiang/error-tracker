import type { Integration } from '../types'
import type { ErrorTrackerClient } from '../core/client'

export class BrowserBreadcrumbsIntegration implements Integration {
  name = 'BrowserBreadcrumbs'
  private origFetch?: typeof fetch

  setup(client: ErrorTrackerClient): void {
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement
        client.breadcrumbs.add({
          timestamp: Date.now(),
          type: 'ui.click',
          message: `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}`,
          data: { text: target.textContent?.slice(0, 64) },
        })
      },
      { passive: true, capture: true },
    )

    const addNav = () =>
      client.breadcrumbs.add({
        timestamp: Date.now(),
        type: 'navigation',
        data: { to: location.href },
      })
    window.addEventListener('popstate', addNav)
    window.addEventListener('hashchange', addNav)

    this.origFetch = window.fetch.bind(window)
    const patchedFetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      const method = (args[1]?.method ?? 'GET').toUpperCase()
      const start = Date.now()
      try {
        const res = await this.origFetch!(...args)
        client.breadcrumbs.add({
          timestamp: start,
          type: 'http',
          data: { url, method, status: res.status, duration: Date.now() - start },
        })
        return res
      } catch (err) {
        client.breadcrumbs.add({
          timestamp: start,
          type: 'http',
          data: { url, method, error: String(err) },
        })
        throw err
      }
    }
    window.fetch = patchedFetch as typeof fetch

    for (const level of ['error', 'warn'] as const) {
      const orig = console[level].bind(console)
      console[level] = (...args: unknown[]) => {
        client.breadcrumbs.add({
          timestamp: Date.now(),
          type: 'console',
          message: args.map(String).join(' ').slice(0, 256),
          data: { level },
        })
        orig(...args)
      }
    }
  }

  teardown(): void {
    if (this.origFetch) window.fetch = this.origFetch
  }
}
