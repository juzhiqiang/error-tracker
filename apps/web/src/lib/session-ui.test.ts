import { describe, expect, it } from 'bun:test'
import {
  dashboardUtilityNav,
  getSessionDisplayName,
  getSessionInitials,
  getWelcomePrimaryAction,
  type SessionUserSummary,
} from './session-ui'

describe('session UI helpers', () => {
  it('uses the signed-in user name or email for compact identity display', () => {
    expect(getSessionDisplayName({ name: 'Ada Lovelace', email: 'ada@example.com' })).toBe('Ada Lovelace')
    expect(getSessionDisplayName({ name: '', email: 'ada@example.com' })).toBe('ada@example.com')
    expect(getSessionDisplayName(null, 'Signed-in user')).toBe('Signed-in user')
  })

  it('derives stable initials from the display identity', () => {
    expect(getSessionInitials({ name: 'Ada Lovelace', email: 'ada@example.com' })).toBe('AL')
    expect(getSessionInitials({ name: '', email: 'ada@example.com' })).toBe('A')
    expect(getSessionInitials(null)).toBe('ET')
  })

  it('routes welcome primary actions by authentication state', () => {
    const user: SessionUserSummary = { name: 'Ada Lovelace', email: 'ada@example.com' }

    expect(getWelcomePrimaryAction(user)).toEqual({ href: '/', labelKey: 'welcome.nav.console' })
    expect(getWelcomePrimaryAction(null)).toEqual({ href: '/login', labelKey: 'welcome.nav.signIn' })
  })

  it('keeps product tour reachable from the authenticated console', () => {
    expect(dashboardUtilityNav).toContainEqual({ href: '/welcome', labelKey: 'nav.productTour' })
  })
})
