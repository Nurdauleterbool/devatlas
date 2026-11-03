// GitHub Issue #58 — authentication
import { expect, test } from '@playwright/test'
import { register } from './helpers'

test('02 Signup, incorrect login, valid login and logout', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  const credentials = await register(page, 'Auth E2E')
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/login')
  await page.getByLabel('Email', { exact: true }).fill(credentials.email)
  await page.getByLabel('Password', { exact: true }).fill('invalid-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toContainText('incorrect')
  await page.getByLabel('Password', { exact: true }).fill(credentials.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('status')).toContainText('Signed in as Auth E2E.')
  await page.reload()
  await expect(page.getByRole('status')).toContainText('Signed in as Auth E2E.')
})
