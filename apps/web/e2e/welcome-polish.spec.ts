import { expect, test } from '@playwright/test'

test('welcome page renders without client errors or horizontal overflow', async ({ page }) => {
  const messages: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text())
  })
  page.on('pageerror', (error) => messages.push(error.message))

  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/welcome')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const width = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth)
  expect(messages).toEqual([])
})

test('welcome first screen background fills the initial viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/welcome')
  await expect(page.locator('.welcome-flagship-hero')).toBeVisible()

  const firstScreen = await page.evaluate(() => {
    const hero = document.querySelector('.welcome-flagship-hero')?.getBoundingClientRect()
    const field = document.querySelector('.welcome-orbit-field')?.getBoundingClientRect()

    return {
      heroHeight: hero?.height ?? 0,
      fieldTop: field?.top ?? Number.NaN,
      viewportHeight: window.innerHeight,
    }
  })

  expect(firstScreen.heroHeight).toBeGreaterThanOrEqual(firstScreen.viewportHeight)
  expect(firstScreen.heroHeight).toBeLessThanOrEqual(firstScreen.viewportHeight + 180)
  expect(firstScreen.fieldTop).toBe(0)
})
