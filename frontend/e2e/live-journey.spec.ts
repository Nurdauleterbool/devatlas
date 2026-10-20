import { expect, test } from '@playwright/test'
import { seedFixtures } from '../src/services/fixtures'

test('live FastAPI journey: signup, path, graph, quiz, analytics, reload and second account', async ({ page, browser }) => {
  const username = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const password = 'LiveBrowserTest123!'
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/signup')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  await page.getByLabel('Name', { exact: true }).fill('Live Tester')
  await page.getByLabel('Email', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Signed in as Live Tester.')).toBeVisible()
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your first career path' })).toBeVisible()

  await page.getByRole('button', { name: 'Choose Frontend Developer', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('Frontend Developer')
  await page.goto('/graph?path=frontend')
  await expect(page.getByRole('heading', { name: 'Skill Graph' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open HTML details' })).toBeVisible()

  await page.goto('/skills/html/quiz')
  await expect(page.getByRole('heading', { name: 'HTML quiz' })).toBeVisible()
  const quiz = seedFixtures.quizzes.find((entry) => entry.skillId === 'html')!
  for (const [index, question] of quiz.questions.entries()) {
    const expected = seedFixtures.answerKeys[question.id].correctOptionId
    const answer = question.options.find((item) => index < 4
      ? item.id === expected : item.id !== expected)!
    await page.getByRole('group', { name: question.prompt })
      .getByRole('radio', { name: answer.text, exact: true }).check()
  }
  await page.getByRole('button', { name: 'Submit quiz' }).click()
  await expect(page.getByRole('region', { name: 'Quiz result' })).toContainText('Score: 80%')
  await expect(page.getByText('Best score: 80%')).toBeVisible()

  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quiz performance' })).toContainText('80%')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Live Tester’s learning overview' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quiz performance' })).toContainText('80%')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('Frontend Developer')

  const second = await browser.newContext()
  const other = await second.newPage()
  try {
    await other.goto('/analytics')
    await expect(other.getByText('Your progress belongs to you')).toBeVisible()
    await other.goto('/signup')
    await other.getByLabel('Name', { exact: true }).fill('Another Student')
    await other.getByLabel('Email', { exact: true }).fill(`other-${username}`)
    await other.getByLabel('Password', { exact: true }).fill(password)
    await other.getByLabel('Confirm password', { exact: true }).fill(password)
    await other.getByRole('button', { name: 'Create account' }).click()
    await other.getByRole('link', { name: 'Continue to Dashboard' }).click()
    await expect(other.getByRole('heading', { name: 'Choose your first career path' })).toBeVisible()
  } finally { await second.close() }
  expect(errors).toEqual([])
})


test('live keyboard and responsive accessibility smoke checks', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const navigation = page.getByRole('navigation', { name: 'Main navigation' })
    const mobileToggle = page.getByRole('button', { name: 'Open navigation' })
    if (await mobileToggle.isVisible()) {
      await mobileToggle.click()
      await expect(page.getByRole('dialog').getByRole('navigation')).toBeVisible()
      await page.keyboard.press('Escape')
    } else {
      await expect(navigation).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const links = page.getByRole('link')
    expect(await links.count()).toBeGreaterThan(0)
    const skip = page.getByRole('link', { name: /skip to main content/i })
    if (await skip.count()) {
      await skip.focus()
      await expect(skip).toBeFocused()
    }
  }
  await page.goto('/signup')
  for (const label of ['Name', 'Email', 'Password', 'Confirm password']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  await page.goto('/analytics')
  await expect(page.getByText('Your progress belongs to you')).toBeVisible()
  expect(runtimeErrors).toEqual([])
})
