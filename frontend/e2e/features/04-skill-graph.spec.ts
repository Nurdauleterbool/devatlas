// GitHub Issue #60 — skill graph, prerequisites and keyboard
import { expect, test } from '@playwright/test'

test('04 Skill graph nodes, prerequisites and keyboard modal', async ({ page }) => {
  await page.goto('/graph?path=frontend')
  const graph = page.getByRole('region', { name: 'Skill dependency graph' })
  await expect(graph.locator('.react-flow__node')).toHaveCount(4)
  await expect(graph.locator('.react-flow__edge')).toHaveCount(3)
  const opener = page.getByRole('button', { name: 'Open React details' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'React details' })
  await expect(dialog).toContainText('JavaScript')
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
  await page.getByLabel('Career path', { exact: true }).selectOption('backend')
  await expect(graph.locator('.react-flow__node')).toHaveCount(4)
})
