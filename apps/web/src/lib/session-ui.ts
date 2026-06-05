export interface SessionUserSummary {
  name?: string | null
  email?: string | null
}

export const dashboardUtilityNav = [{ href: '/welcome', labelKey: 'nav.productTour' }] as const

export function getSessionDisplayName(user: SessionUserSummary | null | undefined, fallback = 'Error Tracker') {
  const name = user?.name?.trim()
  if (name) return name
  const email = user?.email?.trim()
  return email || fallback
}

export function getSessionInitials(user: SessionUserSummary | null | undefined) {
  const displayName = getSessionDisplayName(user, 'Error Tracker')
  const localPart = displayName.includes('@') ? displayName.split('@')[0] : displayName
  const parts = localPart
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0]?.[0] ?? 'E').toUpperCase()
}

export function getWelcomePrimaryAction(user: SessionUserSummary | null | undefined) {
  return user?.email || user?.name
    ? { href: '/', labelKey: 'welcome.nav.console' }
    : { href: '/login', labelKey: 'welcome.nav.signIn' }
}
