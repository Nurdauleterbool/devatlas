// GitHub Issue #64 — per-user history and performance
import { expect, test } from '@playwright/test'
import { register, selectFrontend, submitHtmlQuiz } from './helpers'

test('08 Analytics with quiz scores and learning history', async ({ page }) => {
  await register(page, 'Analytics E2E')
  await selectFrontend(page)
  await page.goto('/skills/html')
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status' }).click()
  await expect(page.getByRole('status')).toContainText('Learning status saved')
  await submitHtmlQuiz(page, 4)
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: /Analytics E2E.s learning overview/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quiz performance' })).toContainText('80%')
  await expect(page.getByRole('table', { name: 'Learning status history' })).toContainText('HTML')
  await expect(page.getByRole('table', { name: 'Quiz attempt history' })).toContainText('HTML')
  await expect(page.getByRole('img', { name: 'Learning completion over time' })).toBeVisible()
})
