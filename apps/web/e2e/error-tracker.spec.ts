import { expect, request, test } from '@playwright/test'

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3002'
const E2E_EMAIL = process.env.E2E_EMAIL ?? 'e2e-owner@example.com'
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password-123'

test('production smoke path creates project, uploads sourcemap, ingests event, and shows issue detail', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(E2E_EMAIL)
  await page.getByLabel(/password/i).fill(E2E_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/$/)

  const stamp = Date.now()
  const projectName = `E2E Project ${stamp}`
  const projectSlug = `e2e-${stamp}`

  await page.goto('/settings')
  await page.getByLabel(/project name/i).fill(projectName)
  await page.getByLabel(/slug/i).fill(projectSlug)
  await page.getByRole('button', { name: /create project/i }).click()
  await expect(page.getByText(/project created/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

  // The settings page exposes the DSN as two fields: the token-less Ingest URL and the DSN token.
  const ingestUrl = await page.getByLabel('Ingest URL').inputValue()
  const token = await page.getByLabel('DSN Token').inputValue()
  const match = ingestUrl.match(/\/ingest\/([^/]+)$/)
  expect(match).not.toBeNull()
  const projectId = match![1]
  expect(token).not.toBe('')

  await page.getByLabel(/release/i).fill('web@e2e')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'app.js.map',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 3,
        file: 'app.js',
        sources: ['src/smoke.ts'],
        names: ['runSmoke'],
        mappings: 'AAAA',
      }),
    ),
  })
  await expect(page.getByText(/1 files selected/i)).toBeVisible()

  const uploadResponse = page.waitForResponse(
    (response) => response.url().includes(`/api/sourcemaps/${projectId}/web%40e2e`) && response.status() === 201,
  )
  await page.getByRole('button', { name: /upload sourcemaps/i }).click()
  await uploadResponse
  await expect(page.getByText(/sourcemap files uploaded/i)).toBeVisible()

  const api = await request.newContext()
  const eventId = `e2e-${stamp}`
  const response = await api.post(`${API_URL}/ingest/${projectId}/${token}`, {
    data: {
      events: [
        {
          eventId,
          timestamp: Date.now(),
          level: 'error',
          message: 'e2e production smoke error',
          fingerprint: 'e2e-production-smoke',
          stacktrace: [{ function: 'runSmoke', filename: 'app.js', lineno: 1, colno: 0 }],
          breadcrumbs: [
            {
              timestamp: Date.now(),
              type: 'navigation',
              message: 'opened smoke route',
            },
          ],
          release: 'web@e2e',
          environment: 'e2e',
          tags: { flow: 'production-smoke' },
        },
      ],
      sentAt: new Date().toISOString(),
    },
  })
  expect(response.status()).toBe(202)
  await api.dispose()

  await page.goto('/issues')
  await expect(page.getByText('e2e production smoke error')).toBeVisible()
  await page.getByText('e2e production smoke error').click()
  await expect(page.getByText(/stack trace/i)).toBeVisible()
  await expect(page.getByText(/runSmoke|src\/smoke\.ts/)).toBeVisible()
  await expect(page.getByText(/breadcrumbs/i)).toBeVisible()
})
