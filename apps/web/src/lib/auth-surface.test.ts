import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

describe('authentication entry points', () => {
  it('exposes a standalone signup page for first administrator registration', () => {
    expect(existsSync(new URL('../app/(auth)/signup/page.tsx', import.meta.url))).toBe(true)

    const signupPage = readSource('../app/(auth)/signup/page.tsx')
    const i18n = readSource('./i18n.tsx')

    expect(signupPage).toContain('authClient.signUp.email')
    expect(signupPage).toContain("router.push('/settings')")
    expect(signupPage).toContain("href=\"/login\"")
    expect(signupPage).toContain("signup.title")
    expect(signupPage).toContain("signup.submit")
    expect(i18n).toContain("'signup.title'")
    expect(i18n).toContain("'signup.submit'")
  })

  it('links the login page to public signup', () => {
    const loginPage = readSource('../app/(auth)/login/page.tsx')
    const i18n = readSource('./i18n.tsx')

    expect(loginPage).toContain("href=\"/signup\"")
    expect(loginPage).toContain("login.createAccount")
    expect(i18n).toContain("'login.createAccount'")
  })

  it('keeps invitation signup and signed-in acceptance as separate paths', () => {
    const invitePage = readSource('../app/accept-invite/[token]/page.tsx')

    expect(invitePage).toContain('authClient.useSession')
    expect(invitePage).toContain('session.data')
    expect(invitePage).toContain('authClient.signIn.email')
    expect(invitePage).toContain('authClient.signUp.email')
    expect(invitePage).toContain("invite.acceptSignedIn")
  })
})
