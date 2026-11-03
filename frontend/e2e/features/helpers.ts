import { expect, type Page } from '@playwright/test'
import { seedFixtures } from '../../src/services/fixtures'

export async function register(page: Page, name = 'E2E Student') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const password = 'PlaywrightTest123!'
  await page.goto('/signup')
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(`Signed in as ${name}.`)
  await page.getByRole('link', { name: 'Continue to Dashboard' }).click()
  return { email, password }
}

export async function selectFrontend(page: Page) {
  await page.getByRole('button', { name: 'Choose Frontend Developer', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Selected career overview' })).toContainText('Frontend Developer')
}

export async function submitHtmlQuiz(page: Page, correctAnswers: number, navigate = true) {
  if (navigate) await page.goto('/skills/html/quiz')
  await expect(page.getByRole('heading', { name: 'HTML quiz' })).toBeVisible()
  const quiz = seedFixtures.quizzes.find(item => item.skillId === 'html')!
  for (const [index, question] of quiz.questions.entries()) {
    const correct = seedFixtures.answerKeys[question.id].correctOptionId
    const option = question.options.find(item => index < correctAnswers ? item.id === correct : item.id !== correct)!
    await page.getByRole('group', { name: question.prompt })
      .getByRole('radio', { name: option.text, exact: true }).check()
  }
  await page.getByRole('button', { name: 'Submit quiz', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Quiz result' })).toContainText(`Score: ${correctAnswers * 20}%`)
}
