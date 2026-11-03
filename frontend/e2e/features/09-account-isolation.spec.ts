// GitHub Issue #65 — user isolation for PostgreSQL persistent data
import { expect, test } from '@playwright/test'
import { register, selectFrontend } from './helpers'

test('09 Different accounts cannot read one another\'s progress', async ({ page, browser }) => {
  await register(page, 'Owner E2E')
  await selectFrontend(page)
  const secondContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const other = await secondContext.newPage()
    await other.goto('/analytics')
    await expect(other.getByText('Your progress belongs to you')).toBeVisible()
    await register(other, 'Other E2E')
    await expect(other.getByRole('heading', { name: 'Choose your first career path' })).toBeVisible()
    await other.goto('/analytics')
    await expect(other.getByRole('heading', { name: /Other E2E.s learning overview/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('Frontend Developer')
  } finally {
    await secondContext.close()
  }
})
