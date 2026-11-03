// GitHub Issue #63 — dynamic explainable recommendations
import { expect, test } from '@playwright/test'
import { register, selectFrontend } from './helpers'

test('07 Recommendations change with completed skills', async ({ page }) => {
  await register(page)
  await selectFrontend(page)
  const recommendations = page.getByRole('heading', { name: 'Recommended next skills' }).locator('..')
  await expect(recommendations).toContainText('HTML')
  await page.goto('/skills/html')
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status' }).click()
  await expect(page.getByRole('status')).toContainText('Learning status saved')
  await page.goto('/')
  await expect(recommendations).toContainText('CSS')
  await expect(page.getByRole('heading', { name: 'Your skill gaps' }).locator('..')).toContainText('React')
})
