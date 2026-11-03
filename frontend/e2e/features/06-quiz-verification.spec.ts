// GitHub Issue #62 — quiz and best-score verification
import { expect, test } from '@playwright/test'
import { register, submitHtmlQuiz } from './helpers'

test('06 Quiz scoring, retakes and best score 80% threshold', async ({ page }) => {
  await register(page)
  await submitHtmlQuiz(page, 3)
  await expect(page.getByRole('region', { name: 'Quiz result' })).toContainText('Keep practicing')
  await page.getByRole('button', { name: 'Retake quiz' }).click()
  await submitHtmlQuiz(page, 4, false)
  await expect(page.getByRole('region', { name: 'Quiz result' })).toContainText('Quiz passed')
  await expect(page.getByText('Best score: 80%')).toBeVisible()
  await page.getByRole('button', { name: 'Retake quiz' }).click()
  await submitHtmlQuiz(page, 0, false)
  await expect(page.getByText('Best score: 80%')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Best score: 80%')).toBeVisible()
})
