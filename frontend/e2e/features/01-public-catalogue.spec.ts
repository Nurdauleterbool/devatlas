// GitHub Issue #57 — public catalogue
import { expect, test } from '@playwright/test'

test('01 Public catalogue, learning details and guest access', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('3 paths available')).toBeVisible()
  await page.goto('/learning')
  await expect(page.getByRole('region', { name: 'Learning skills' }).getByRole('article')).toHaveCount(10)
  await page.getByRole('link', { name: 'Study React', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'React', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Free learning resources' })).toBeVisible()
  await page.goto('/analytics')
  await expect(page.getByText('Your progress belongs to you')).toBeVisible()
})
