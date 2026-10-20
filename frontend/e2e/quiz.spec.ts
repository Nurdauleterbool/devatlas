import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedFixtures } from '../src/services/fixtures'

const htmlQuiz = seedFixtures.quizzes.find((quiz) => quiz.skillId === 'html')!
const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const observed: string[] = []
  errors.set(page, observed)
  page.on('pageerror', (error) => observed.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

async function openQuiz(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Try mock demo account' }).click()
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Learning', exact: true }).click()
  await page.getByRole('link', { name: 'Study HTML', exact: false }).click()
  await page.getByRole('link', { name: 'Take practice quiz', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'HTML quiz', exact: true })).toBeVisible()
  await expect(page.getByText('Best score: 60%', { exact: true })).toBeVisible()
}

async function answer(page: Page, correctCount: number) {
  // Grading keys are used only by the Node test runner, never injected into UI.
  for (const [index, question] of htmlQuiz.questions.entries()) {
    const correctId = seedFixtures.answerKeys[question.id].correctOptionId
    const option = question.options.find((item) => index < correctCount ? item.id === correctId : item.id !== correctId)!
    await page.getByRole('group', { name: question.prompt }).getByRole('radio', { name: option.text, exact: true }).check()
  }
}

test('quiz shows five questions, four choices and no explanations before submission', async ({ page }) => {
  await openQuiz(page)
  await expect(page.getByRole('radio')).toHaveCount(20)
  for (const question of htmlQuiz.questions) {
    await expect(page.getByRole('group', { name: question.prompt }).getByRole('radio')).toHaveCount(4)
    await expect(page.getByText(seedFixtures.answerKeys[question.id].explanation, { exact: true })).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/answer/i)
  await expect(page.getByRole('group', { name: htmlQuiz.questions[0].prompt }).getByRole('radio').first()).toBeFocused()
})

test('80 percent verifies the skill, explains answers and failing retakes keep the best score', async ({ page }) => {
  await openQuiz(page)
  await answer(page, 4)
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  const result = page.getByRole('region', { name: 'Quiz result', exact: true })
  await expect(result).toContainText('Score: 80%')
  await expect(result).toContainText(/verified/i)
  await expect(page.getByText('Best score: 80%', { exact: true })).toBeVisible()
  await expect(result).toContainText(seedFixtures.answerKeys[htmlQuiz.questions[4].id].explanation)
  await page.getByRole('button', { name: 'Retake quiz', exact: true }).click()
  await expect(page.getByRole('radio').first()).not.toBeChecked()
  await expect(result).toHaveCount(0)
  await answer(page, 0)
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(result).toContainText('Score: 0%')
  await expect(page.getByText('Best score: 80%', { exact: true })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Skill Graph', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open HTML details', exact: true })).toContainText(/verified/i)
})

test('a below-threshold attempt fails and a retry can pass', async ({ page }) => {
  await openQuiz(page)
  await answer(page, 3)
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  const result = page.getByRole('region', { name: 'Quiz result', exact: true })
  await expect(result).toContainText('Score: 60%')
  await expect(result).toContainText(/not passed|keep practicing|below/i)
  await page.getByRole('button', { name: 'Retake quiz', exact: true }).click()
  await answer(page, 5)
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(result).toContainText('Score: 100%')
  await expect(page.getByText('Best score: 100%', { exact: true })).toBeVisible()
})

test('submission failure preserves answers and permits a deliberate retry', async ({ page }) => {
  await openQuiz(page)
  await answer(page, 4)
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    const original = service.submitQuizAttempt.bind(service)
    let failed = false
    service.submitQuizAttempt = async (input: unknown) => {
      if (!failed) { failed = true; throw new Error('Simulated submission failure') }
      return original(input)
    }
  })
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/could not|unavailable|failed/i)
  await expect(page.getByRole('region', { name: 'Quiz result', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: htmlQuiz.questions[0].prompt }).getByRole('radio', { checked: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Quiz result', exact: true })).toContainText('Score: 80%')
})

test('a recorded attempt survives refresh failure and refresh retry never submits twice', async ({ page }) => {
  await openQuiz(page)
  await answer(page, 4)
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    const submit = service.submitQuizAttempt.bind(service)
    Object.assign(window, { quizSubmissions: 0 })
    service.submitQuizAttempt = async (input: unknown) => {
      (window as Window & { quizSubmissions: number }).quizSubmissions++
      return submit(input)
    }
    const original = service.getAnalytics.bind(service)
    let failed = false
    service.getAnalytics = async () => {
      if (!failed) { failed = true; throw new Error('Simulated post-submit refresh failure') }
      return original()
    }
  })
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Quiz result', exact: true })).toContainText('Score: 80%')
  await page.getByRole('button', { name: 'Retry progress refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry progress refresh', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => (window as Window & { quizSubmissions: number }).quizSubmissions)).toBe(1)
  await expect(page.getByText('Best score: 80%', { exact: true })).toBeVisible()
})

test('anonymous users cannot submit and missing quizzes are navigable', async ({ page }) => {
  await page.goto('/skills/html/quiz')
  await expect(page.getByRole('heading', { name: 'HTML quiz', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit quiz', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /log in/i }).last()).toBeVisible()
  await page.goto('/skills/missing/quiz')
  await expect(page.getByRole('heading', { name: 'Skill not found', exact: true })).toBeVisible()
})

test('duplicate submissions are blocked and a pending attempt refreshes a reopened quiz', async ({ page }) => {
  await openQuiz(page)
  await answer(page, 4)
  await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    const { service } = await import(path)
    const original = service.submitQuizAttempt.bind(service)
    const gate = new Promise<void>((resolve) => Object.assign(window, { releaseQuizSubmission: resolve }))
    Object.assign(window, { quizSubmissions: 0 })
    service.submitQuizAttempt = async (input: unknown) => {
      (window as Window & { quizSubmissions: number }).quizSubmissions++
      await gate
      return original(input)
    }
  })
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await expect(page.getByRole('radio').first()).toBeDisabled()
  await page.getByRole('navigation').getByRole('link', { name: 'Learning', exact: true }).click()
  await page.getByRole('link', { name: 'Study HTML', exact: false }).click()
  await page.getByRole('link', { name: 'Take practice quiz', exact: true }).click()
  await expect(page.getByText('Best score: 60%', { exact: true })).toBeVisible()
  await page.evaluate(() => (window as Window & { releaseQuizSubmission: () => void }).releaseQuizSubmission())
  await expect(page.getByText('Best score: 80%', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { quizSubmissions: number }).quizSubmissions)).toBe(1)
})

test('question forms fit 320px, 375px, tablet and desktop layouts', async ({ page }) => {
  await openQuiz(page)
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('radio').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
