import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const password = 'BrowserTest123!'
const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const observed: string[] = []
  errors.set(page, observed)
  page.on('pageerror', (error) => observed.push(error.message))
  page.on('console', (message) => {
    if (message.text().includes(password)) observed.push('Credential appeared in console output')
  })
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

async function fillSignup(page: Page, name = 'Alice', email = 'alice@example.test') {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
}

test('signup validates fields accessibly, masks passwords and focuses the first error', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused()
  await expect(page.getByText('Enter your email address.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription(/Enter your email/)
  await fillSignup(page)
  await page.getByLabel('Email', { exact: true }).fill('invalid-email')
  await page.getByLabel('Password', { exact: true }).fill('short')
  await page.getByLabel('Confirm password', { exact: true }).fill('mismatch')
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
  await expect(page.getByText('Passwords must match.')).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveAttribute('type', 'password')
  await expect(page.getByText(password, { exact: true })).toHaveCount(0)
})

test('signup, logout and login restore the same mock account and navigation', async ({ page }) => {
  await page.goto('/signup')
  await fillSignup(page)
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await expect(page.getByRole('status')).toContainText('Mock account created. Signed in as Alice.')
  await expect(page.getByRole('region', { name: 'Mock account' })).toContainText('Alice')
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Career Paths' }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('status')).toHaveText('You are signed out.')
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0)
  await page.getByLabel('Email', { exact: true }).fill('ALICE@EXAMPLE.TEST')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Signed in as Alice.')
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await expect(page.getByText('3 paths available')).toBeVisible()
})

test('invalid credentials show a focused error and clear the masked password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect. Please try again.')
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('unknown@example.test')
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled()
})

test('duplicate signup email reports a clear error without signing in', async ({ page }) => {
  await page.goto('/signup')
  await fillSignup(page)
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await expect(page.getByRole('status')).toContainText('Signed in as Alice')
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByRole('link', { name: 'Sign up', exact: true }).first().click()
  await fillSignup(page, 'Another Alice', 'ALICE@EXAMPLE.TEST')
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await expect(page.getByRole('alert')).toHaveText('An account already uses this email. Try logging in.')
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0)
})

test('loading disables the form and duplicate submission does not create a second account', async ({ page }) => {
  await page.goto('/signup?mockLatencyMs=700')
  await expect(page.getByRole('button', { name: 'Create mock account' })).toBeEnabled()
  await fillSignup(page)
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await expect(page.getByRole('button', { name: 'Please wait…', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('Creating your mock account')
  await expect(page.getByRole('status')).toContainText('Mock account created. Signed in as Alice.')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('demo login is labelled mock and session resets on reload', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText(/Mock authentication for this prototype/)).toBeVisible()
  await page.getByRole('button', { name: 'Try mock demo account' }).click()
  await expect(page.getByRole('status')).toContainText('Signed in as Demo Student.')
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await expect(page.getByText('3 paths available')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Mock account' })).toContainText('Preview · sample progress')
})

test('mobile signup supports keyboard submission and logout closes navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Sign up', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await fillSignup(page)
  await page.getByLabel('Confirm password', { exact: true }).press('Enter')
  await expect(page.getByRole('status')).toContainText('Signed in as Alice.')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog')).toContainText('Alice')
  await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('status')).toHaveText('You are signed out.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('configured authentication failure remains retryable and does not create a session', async ({ page }) => {
  await page.goto('/signup?mockScenario=error')
  await fillSignup(page)
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await expect(page.getByRole('alert')).toHaveText('Mock authentication is unavailable. Please try again.')
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByRole('button', { name: 'Create mock account' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toHaveCount(0)
})

test('logout failure preserves the session and offers a retry', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Try mock demo account' }).click()
  await expect(page.getByRole('status')).toContainText('Signed in as Demo Student.')
  await page.evaluate(async () => {
    const modulePath = '/src/services/index.ts'
    const { service } = await import(modulePath)
    service.logOut = async () => { throw new Error('Simulated logout failure') }
  })
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Could not log out. Your mock session is still active. Try again.')
  await expect(page.getByRole('status')).toContainText('Signed in as Demo Student.')
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeEnabled()
})
