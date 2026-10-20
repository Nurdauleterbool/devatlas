import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const observed: string[] = []
  errors.set(page, observed)
  page.on('pageerror', (error) => observed.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Try mock demo account' }).click()
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toBeVisible()
}

async function studyCss(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Learning', exact: true }).click()
  await page.getByRole('link', { name: 'Study CSS', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'CSS', exact: true })).toBeVisible()
}

async function deferProgress(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    const original = service.updateProgress.bind(service)
    const gate = new Promise<void>((resolve) => Object.assign(window, { releaseProgressWrite: resolve }))
    Object.assign(window, { progressWriteCalls: 0 })
    service.updateProgress = async (input: unknown) => {
      const state = window as Window & { progressWriteCalls: number }
      state.progressWriteCalls++
      await gate
      return original(input)
    }
  })
}

async function reopenCss(page: Page) {
  await page.getByRole('link', { name: /Browse learning skills/ }).click()
  await page.getByRole('link', { name: 'Study CSS', exact: false }).click()
  await expect(page.getByLabel('Learning status', { exact: true })).toBeEnabled()
}

async function releaseProgress(page: Page) {
  await page.evaluate(() => (window as Window & { releaseProgressWrite: () => void }).releaseProgressWrite())
}

test('learning catalogue opens complete skill details and safe free resources', async ({ page }) => {
  await page.goto('/learning')
  await expect(page.getByRole('region', { name: 'Learning skills' }).getByRole('article')).toHaveCount(10)
  await page.getByRole('link', { name: 'Study React', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'React', exact: true })).toBeVisible()
  await expect(page.getByText('Compose interfaces with components, props, and state.')).toBeVisible()
  const resource = page.getByRole('region', { name: 'Free learning resources' }).getByRole('link')
  await expect(resource).toHaveAttribute('href', 'https://react.dev/learn')
  await expect(resource).toHaveAttribute('target', '_blank')
  await expect(resource).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(page.getByRole('region', { name: 'Practice exercise' })).toContainText('Stateful selector')
  await expect(page.getByRole('link', { name: 'Take practice quiz' })).toHaveAttribute('href', '/skills/react/quiz')
  await expect(page.getByLabel('Learning status', { exact: true })).toHaveCount(0)
  await page.getByRole('region', { name: 'Skill prerequisites' }).getByRole('link', { name: 'JavaScript', exact: true }).click()
  await expect(page).toHaveURL('/skills/javascript')
  await expect(page.getByRole('heading', { name: 'JavaScript', exact: true })).toBeVisible()
})

test('graph details navigate prerequisite skills and keep keyboard focus inside the modal', async ({ page }) => {
  await page.goto('/graph')
  await page.getByRole('button', { name: 'Open React details', exact: true }).click()
  const react = page.getByRole('dialog', { name: 'React details', exact: true })
  await expect(react.getByRole('region', { name: 'Free learning resources' })).toContainText('React: Learn')
  await react.getByRole('region', { name: 'Skill prerequisites' }).getByRole('button', { name: 'JavaScript', exact: true }).click()
  const javascript = page.getByRole('dialog', { name: 'JavaScript details', exact: true })
  await expect(javascript.getByRole('heading', { name: 'JavaScript', exact: true })).toBeFocused()
  await expect(javascript.getByRole('region', { name: 'Practice exercise' })).toContainText('Async list')
  await page.keyboard.press('Escape')
  await expect(javascript).not.toBeVisible()
})

test('status save updates the dashboard and graph without changing quiz verification', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Learning status saved.')
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Not quiz verified.')
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('2 of 4 unique skills completed')
  await page.getByRole('navigation').getByRole('link', { name: 'Skill Graph', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open CSS details', exact: true })).toContainText('Completed')
})

test('failed progress writes retain confirmed status and can be retried', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    const original = service.updateProgress.bind(service)
    let failed = false
    service.updateProgress = async (input: unknown) => {
      if (!failed) { failed = true; throw new Error('Simulated status write failure') }
      return original(input)
    }
  })
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your change may already be saved')
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Current status: Learning')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Learning status saved.')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('duplicate submissions are guarded and a pending save refreshes after leaving details', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await deferProgress(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await expect(page.getByLabel('Learning status', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Saving learning status…', exact: true })).toBeDisabled()
  await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click()
  await releaseProgress(page)
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('2 of 4 unique skills completed')
  expect(await page.evaluate(() => (window as Window & { progressWriteCalls: number }).progressWriteCalls)).toBe(1)
})

test('reopened details reconcile a save completed by the previous view', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await deferProgress(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await reopenCss(page)
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Current status: Learning')
  await releaseProgress(page)
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Current status: Completed')
  await expect(page.getByLabel('Learning status', { exact: true })).toHaveValue('completed')
})

test('a newer progress intent after remount wins over an older delayed save', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await deferProgress(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await reopenCss(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('not_started')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByLabel('Learning status', { exact: true })).toBeDisabled()
  expect(await page.evaluate(() => (window as Window & { progressWriteCalls: number }).progressWriteCalls)).toBe(1)
  await releaseProgress(page)
  await expect(page.getByRole('status')).toHaveText('Learning status saved.')
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Current status: Not started')
  const stored = await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    return (await (await import(path)).service.getProgress()).find((item: { skillId: string }) => item.skillId === 'css').status
  })
  expect(stored).toBe('not_started')
})

test('background confirmation keeps a different unsaved form choice intact', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await deferProgress(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await reopenCss(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('not_started')
  await releaseProgress(page)
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Current status: Completed')
  await expect(page.getByLabel('Learning status', { exact: true })).toHaveValue('not_started')
})

test('another account starts with isolated learning status', async ({ page }) => {
  await signIn(page)
  await studyCss(page)
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Learning status saved.')
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByRole('link', { name: 'Sign up', exact: true }).first().click()
  await page.getByLabel('Name', { exact: true }).fill('Different Student')
  await page.getByLabel('Email', { exact: true }).fill('details@example.test')
  await page.getByLabel('Password', { exact: true }).fill('LearningTest123!')
  await page.getByLabel('Confirm password', { exact: true }).fill('LearningTest123!')
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await studyCss(page)
  await expect(page.getByLabel('Learning status', { exact: true })).toHaveValue('not_started')
  await expect(page.getByRole('region', { name: 'Skill learning progress' })).toContainText('Current status: Not started')
})

test('detail failures retry and missing skills remain navigable', async ({ page }) => {
  await page.goto('/skills/missing')
  await expect(page.getByRole('heading', { name: 'Skill not found', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Browse learning skills', exact: true }).click()
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    service.getLearningResources = Object.assign(async () => { throw new Error('Simulated read failure') }, { original: service.getLearningResources })
  })
  await page.getByRole('link', { name: 'Study CSS', exact: false }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load this skill')
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    service.getLearningResources = service.getLearningResources.original
  })
  await page.getByRole('button', { name: 'Retry skill details', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'CSS', exact: true })).toBeVisible()
})

test('skill materials and controls fit mobile, tablet and desktop widths', async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skills/python')
    await expect(page.getByRole('region', { name: 'Practice exercise' })).toContainText('Word counts')
    await expect(page.getByRole('region', { name: 'Free learning resources' }).getByRole('link')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
