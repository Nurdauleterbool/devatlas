import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedFixtures } from '../src/services/fixtures'

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

async function openAnalytics(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Analytics', exact: true }).click()
  await expect(page.getByRole('heading', { name: /learning overview/ })).toBeVisible()
}

test('personal analytics require login without exposing demo history', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('link', { name: 'Log in to view analytics', exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Quiz performance', exact: true })).toHaveCount(0)
})

test('seeded analytics reconcile unique totals, real chronology and career progress', async ({ page }) => {
  await signIn(page)
  await openAnalytics(page)
  await expect(page.getByText('1 of 10 unique skills completed', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quiz performance', exact: true })).toContainText('60%')
  const history = page.getByRole('table', { name: 'Learning status history', exact: true })
  await expect(history.getByRole('row')).toHaveCount(5)
  const times = await history.locator('time').evaluateAll((nodes) => nodes.map((node) => Date.parse(node.getAttribute('datetime')!)))
  expect(times).toEqual([...times].sort((a, b) => a - b))
  const chart = page.getByRole('region', { name: 'Completion over time', exact: true })
  await expect(chart.getByRole('img', { name: 'Learning completion over time', exact: true })).toBeVisible()
  const chartRows = chart.getByRole('table', { name: 'Completion chart data' }).getByRole('row')
  await expect(chartRows).toHaveCount(5)
  await expect(chartRows.nth(1)).toContainText('0%')
  await expect(chartRows.nth(4)).toContainText('10%')
  await expect(page.getByRole('progressbar', { name: 'Frontend Developer completion', exact: true })).toHaveAttribute('aria-valuenow', '25')
  const attempts = page.getByRole('table', { name: 'Quiz attempt history', exact: true })
  await expect(attempts.getByRole('row')).toHaveCount(2)
  await expect(attempts.getByRole('row').nth(1)).toContainText('60%')
  await expect(attempts.getByRole('row').nth(1)).toContainText('Not passed')
})

test('completed progress and quiz attempts update independent analytics values', async ({ page }) => {
  await signIn(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Learning', exact: true }).click()
  await page.getByRole('link', { name: 'Study CSS', exact: false }).click()
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Learning status saved.')
  await page.getByRole('navigation').getByRole('link', { name: 'Learning', exact: true }).click()
  await page.getByRole('link', { name: 'Study HTML', exact: false }).click()
  await page.getByRole('link', { name: 'Take practice quiz', exact: true }).click()
  const quiz = seedFixtures.quizzes.find((item) => item.skillId === 'html')!
  for (const [index, question] of quiz.questions.entries()) {
    const correct = seedFixtures.answerKeys[question.id].correctOptionId
    const option = question.options.find((item) => index < 4 ? item.id === correct : item.id !== correct)!
    await page.getByRole('group', { name: question.prompt }).getByRole('radio', { name: option.text, exact: true }).check()
  }
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Quiz result', exact: true })).toContainText('Score: 80%')
  await openAnalytics(page)
  await expect(page.getByText('2 of 10 unique skills completed', { exact: true })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Learning status history', exact: true }).getByRole('row')).toHaveCount(6)
  await expect(page.getByRole('table', { name: 'Quiz attempt history', exact: true }).getByRole('row')).toHaveCount(3)
  const performance = page.getByRole('region', { name: 'Quiz performance', exact: true })
  await expect(performance).toContainText('1 of 2')
  await expect(performance).toContainText('80%')
  await expect(performance).toContainText('70%')
  await expect(page.getByRole('progressbar', { name: 'Frontend Developer completion', exact: true })).toHaveAttribute('aria-valuenow', '50')
  await expect(page.getByRole('region', { name: 'Career completion', exact: true }).getByRole('article').first()).toContainText('1 quiz verified')
})

test('a pending save refreshes analytics after the details page has unmounted', async ({ page }) => {
  await signIn(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Learning', exact: true }).click()
  await page.getByRole('link', { name: 'Study CSS', exact: false }).click()
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    const update = service.updateProgress.bind(service)
    const gate = new Promise<void>((resolve) => Object.assign(window, { releaseAnalyticsSave: resolve }))
    service.updateProgress = async (input: unknown) => { await gate; return update(input) }
  })
  await page.getByLabel('Learning status', { exact: true }).selectOption('completed')
  await page.getByRole('button', { name: 'Save learning status', exact: true }).click()
  await expect(page.getByLabel('Learning status', { exact: true })).toBeDisabled()
  await openAnalytics(page)
  await expect(page.getByText('1 of 10 unique skills completed', { exact: true })).toBeVisible()
  await page.evaluate(() => (window as Window & { releaseAnalyticsSave: () => void }).releaseAnalyticsSave())
  await expect(page.getByText('2 of 10 unique skills completed', { exact: true })).toBeVisible()
  const history = page.getByRole('table', { name: 'Learning status history', exact: true })
  await expect(history.getByRole('row')).toHaveCount(6)
  await expect(history.getByRole('row').last()).toContainText('CSS')
  await expect(history.getByRole('row').last()).toContainText('Completed')
})

test('new accounts have empty private history and no fabricated chart', async ({ page }) => {
  await signIn(page)
  await openAnalytics(page)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByRole('link', { name: 'Sign up', exact: true }).first().click()
  await page.getByLabel('Name', { exact: true }).fill('Analytics Student')
  await page.getByLabel('Email', { exact: true }).fill('analytics@example.test')
  await page.getByLabel('Password', { exact: true }).fill('AnalyticsTest123!')
  await page.getByLabel('Confirm password', { exact: true }).fill('AnalyticsTest123!')
  await page.getByRole('button', { name: 'Create mock account' }).click()
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await openAnalytics(page)
  await expect(page.getByText('0 of 10 unique skills completed', { exact: true })).toBeVisible()
  await expect(page.getByText('No learning history yet.', { exact: true })).toBeVisible()
  await expect(page.getByText('No quiz attempts yet.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Completion over time', exact: true }).getByRole('img')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Quiz performance', exact: true })).toContainText('No score yet')
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('failed analytics reads show an error and recover on an explicit retry', async ({ page }) => {
  await signIn(page)
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    Object.assign(window, { restoreAnalyticsRead: service.getAnalytics.bind(service) })
    service.getAnalytics = async () => { throw new Error('Simulated analytics read failure') }
  })
  await page.getByRole('navigation').getByRole('link', { name: 'Analytics', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load your analytics')
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    service.getAnalytics = (window as Window & { restoreAnalyticsRead: typeof service.getAnalytics }).restoreAnalyticsRead
  })
  await page.getByRole('button', { name: 'Retry analytics', exact: true }).click()
  await expect(page.getByText('1 of 10 unique skills completed', { exact: true })).toBeVisible()
})

test('chart, histories and career summaries fit phone, tablet and desktop layouts', async ({ page }) => {
  await signIn(page)
  await openAnalytics(page)
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('region', { name: 'Completion over time', exact: true }).getByRole('img')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
