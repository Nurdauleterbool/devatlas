import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const runtimeErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page), 'No uncaught browser runtime errors').toEqual([])
})

test('dashboard preserves mock data, selection, and the career roadmap', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('3 paths available')).toBeVisible()
  await expect(page.locator('main article')).toHaveCount(3)
  const frontend = page.locator('main article').filter({ has: page.getByRole('heading', { name: 'Frontend Developer' }) })
  await frontend.getByRole('button', { name: 'Explore path' }).click()
  await expect(frontend.getByRole('button', { name: 'Selected' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toContainText('Frontend Developer selected!')
  await page.getByRole('link', { name: 'View career paths' }).click()
  await expect(page.getByRole('heading', { name: 'Career Paths', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  await page.getByRole('button', { name: /Backend Developer/ }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByRole('heading', { name: 'FastAPI', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Data Analyst/ }).click()
  await expect(page.getByRole('heading', { name: 'Pandas', exact: true })).toBeVisible()
})

test('all five routes support direct loads, active navigation, and keyboard links', async ({ page }) => {
  const routes = [
    ['/', 'Dashboard', 'Find your direction.'],
    ['/careers', 'Career Paths', 'Career Paths'],
    ['/graph', 'Skill Graph', 'Skill Graph'],
    ['/learning', 'Learning', 'Learning'],
    ['/analytics', 'Analytics', 'Analytics'],
  ]
  for (const [path, label, heading] of routes) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading)
    await expect(page.getByRole('navigation').getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  }
  const dashboard = page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true })
  await dashboard.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('main')).toBeFocused()
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to Dashboard' }).click()
  await expect(page).toHaveURL('/')
})

test('skip link is the first keyboard stop and focuses the main content', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
})

test('mobile menu contains focus, closes with Escape/backdrop, and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  const dialog = page.getByRole('dialog', { name: 'DevAtlas navigation' })
  const close = page.getByRole('button', { name: 'Close DevAtlas navigation' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(close).toBeFocused()
  await expect(close).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('link', { name: 'Analytics' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
  await trigger.click()
  await page.mouse.click(370, 400)
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await close.click()
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('mobile navigation closes after selection and when switching to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  const dialog = page.getByRole('dialog')
  for (const [label, path] of [['Career Paths', '/careers'], ['Skill Graph', '/graph'], ['Learning', '/learning'], ['Analytics', '/analytics'], ['Dashboard', '/']]) {
    await trigger.click()
    const link = dialog.getByRole('link', { name: label, exact: true })
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(path)
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('main')).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await trigger.click()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(5)
})

for (const state of ['loading', 'empty', 'error'] as const) {
  test(`dashboard and career page show the ${state} service state`, async ({ page }) => {
    for (const path of ['/', '/careers']) {
      const query = state === 'loading' ? 'mockLatencyMs=1500' : `mockScenario=${state}`
      await page.goto(`${path}?${query}`)
      if (state === 'loading') {
        await expect(page.getByRole('status')).toHaveText('Loading career paths...')
        if (path === '/') await expect(page.getByText('3 paths available')).toBeVisible()
        else await expect(page.getByRole('progressbar')).toBeVisible()
        continue
      } else if (state === 'empty') await expect(page.getByText('No career paths available.')).toBeVisible()
      else await expect(page.getByRole('alert')).toContainText(/load career paths/)
      await expect(page.getByText('Loading career paths...')).not.toBeVisible()
    }
  })
}

test('career roadmap handles a dataset without the default frontend career', async ({ page }) => {
  await page.route('**/src/services/index.ts', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export const service = {
      getSession: async () => null,
      getCareerPaths: async () => [{ id: "backend", name: "Backend Developer", description: "Backend roadmap", skillIds: [] }],
      getSkills: async () => [], getDependencies: async () => [], getProgress: async () => [],
    }`,
  }))
  await page.goto('/careers')
  await expect(page.getByRole('button', { name: /Backend Developer/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Backend Developer' })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
})

test('inputs expose labels, help and errors; default buttons do not submit forms', async ({ page }) => {
  await page.goto('/e2e/fixtures/ui.html')
  await expect(page.getByRole('article', { name: 'Profile form' })).toBeVisible()
  const name = page.getByRole('textbox', { name: 'Display name' })
  const email = page.getByRole('textbox', { name: 'Email', exact: true })
  await page.getByText('Display name', { exact: true }).click()
  await expect(name).toBeFocused()
  await expect(name).toHaveAttribute('required', '')
  await expect(name).toHaveAccessibleDescription('Shown on your profile.')
  await expect(page.getByRole('textbox', { name: 'Unavailable' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Unavailable action' })).toBeDisabled()
  await page.getByRole('button', { name: 'Validate email' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAccessibleDescription('Your email stays private. Use your email address. Enter a valid email.')
  await name.fill('DevAtlas learner')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByRole('status')).toHaveText('Profile submitted')
})

test('shared dialog has an accessible name/description, modal focus, and repeatable dismissal', async ({ page }) => {
  await page.goto('/e2e/fixtures/ui.html')
  const trigger = page.getByRole('button', { name: 'Open example dialog' })
  const dialog = page.getByRole('dialog', { name: 'Learning goal' })
  await trigger.click()
  await expect(dialog).toHaveAccessibleDescription('Choose one skill to practice.')
  await expect(dialog.getByRole('button', { name: 'Close Learning goal' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Save goal' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close Learning goal' })).toBeFocused()
  await dialog.getByRole('textbox', { name: 'Goal' }).fill('React')
  await dialog.getByRole('button', { name: 'Save goal' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
})
