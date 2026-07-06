import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

describe('account self-service surface', () => {
  it('exposes an account center with profile and password actions', () => {
    expect(existsSync(new URL('../app/(dashboard)/account/page.tsx', import.meta.url))).toBe(true)

    const accountPage = readSource('../app/(dashboard)/account/page.tsx')
    const shell = readSource('../components/dashboard-shell.tsx')
    const i18n = readSource('./i18n.tsx')

    expect(accountPage).toContain('authClient.updateUser')
    expect(accountPage).toContain('authClient.changePassword')
    expect(accountPage).toContain('account.profile.title')
    expect(accountPage).toContain('account.security.title')
    expect(shell).toContain('href="/account"')
    expect(shell).toContain('nav.account')
    expect(i18n).toContain("'nav.account'")
    expect(i18n).toContain("'account.security.submit'")
  })

  it('exposes forgot and reset password pages from the login flow', () => {
    expect(existsSync(new URL('../app/(auth)/forgot-password/page.tsx', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../app/(auth)/reset-password/page.tsx', import.meta.url))).toBe(true)

    const loginPage = readSource('../app/(auth)/login/page.tsx')
    const forgotPage = readSource('../app/(auth)/forgot-password/page.tsx')
    const resetPage = readSource('../app/(auth)/reset-password/page.tsx')
    const resetForm = readSource('../app/(auth)/reset-password/reset-password-form.tsx')
    const i18n = readSource('./i18n.tsx')

    expect(loginPage).toContain('href="/forgot-password"')
    expect(forgotPage).toContain('authClient.requestPasswordReset')
    expect(forgotPage).toContain('/reset-password')
    expect(resetPage).toContain('Suspense')
    expect(resetPage).toContain('ResetPasswordForm')
    expect(resetForm).toContain('authClient.resetPassword')
    expect(resetForm).toContain('useSearchParams')
    expect(i18n).toContain("'forgot.title'")
    expect(i18n).toContain("'reset.title'")
  })
})
