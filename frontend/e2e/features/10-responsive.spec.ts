// GitHub Issue #66 — responsive design and form errors
import { expect, test } from '@playwright/test'

test('10 Responsive mobile/tablet/desktop and validation', async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/graph?path=frontend')
    await expect(page.getByRole('button', { name: 'Open HTML details' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.goto('/signup')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
