// GitHub Issue #61 — saved learning resources/status/history
import { expect, test } from '@playwright/test'
import { register, selectFrontend } from './helpers'

test('05 Learning status persisted in PostgreSQL and history', async ({ page }) => {
  await register(page)
  await selectFrontend(page)
  await page.goto('/skills/html')
  await expect(page.getByRole('region', { name: 'Free learning resources' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Practice exercise' })).toBeVisible()
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status' }).click()
  await expect(page.getByRole('status')).toContainText('Learning status saved')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Completed')
  await page.goto('/analytics')
  await expect(page.getByRole('table', { name: 'Learning status history' })).toContainText('HTML')
})
