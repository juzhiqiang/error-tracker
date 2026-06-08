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
