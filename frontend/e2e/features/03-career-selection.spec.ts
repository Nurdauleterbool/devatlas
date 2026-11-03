// GitHub Issue #59 — saved career selections
import { expect, test } from '@playwright/test'
import { register, selectFrontend } from './helpers'

test('03 Career selection, multi-path roadmap and persistence', async ({ page }) => {
  await register(page)
  await selectFrontend(page)
  await page.getByRole('checkbox', { name: 'Include Backend Developer', exact: true }).check()
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('Frontend Developer + Backend Developer')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('Frontend Developer + Backend Developer')
  await page.getByRole('button', { name: 'Clear selected paths' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your first career path' })).toBeVisible()
})
