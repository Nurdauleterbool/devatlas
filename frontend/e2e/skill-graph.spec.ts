import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const observed: string[] = []
  errors.set(page, observed)
  page.on('pageerror', (error) => observed.push(error.message))
})
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]))

test('each career renders its seeded nodes, directed edges and prerequisite states', async ({ page }) => {
  await page.goto('/graph')
  const graph = page.getByRole('region', { name: 'Skill dependency graph', exact: true })
  const skills = page.getByRole('region', { name: 'Skills in this path', exact: true })
  const paths = [
    { id: 'frontend', nodes: ['html', 'css', 'javascript', 'react'], edges: 3 },
    { id: 'backend', nodes: ['python', 'sql', 'fastapi', 'databases'], edges: 2 },
    { id: 'analyst', nodes: ['python', 'pandas', 'statistics', 'sql'], edges: 1 },
  ]
  for (const path of paths) {
    await page.getByLabel('Career path', { exact: true }).selectOption(path.id)
    await expect(graph.locator('.react-flow__node')).toHaveCount(4)
    await expect(graph.locator('.react-flow__edge')).toHaveCount(path.edges)
    for (const id of path.nodes) await expect(graph.locator(`.react-flow__node[data-id="${id}"]`)).toBeVisible()
    await expect(skills.getByRole('button')).toHaveCount(4)
  }
  await page.getByLabel('Career path', { exact: true }).selectOption('frontend')
  await expect(skills.getByRole('button', { name: 'Open HTML details', exact: true })).toContainText('Completed')
  await expect(skills.getByRole('button', { name: 'Open CSS details', exact: true })).toContainText('Learning')
  await expect(skills.getByRole('button', { name: 'Open JavaScript details', exact: true })).toContainText('Available')
  await expect(skills.getByRole('button', { name: 'Open React details', exact: true })).toContainText('Locked')
})

test('node selection opens matching details and explains missing prerequisites', async ({ page }) => {
  await page.goto('/graph?path=frontend')
  await page.getByRole('button', { name: 'Inspect React in graph', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'React details', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Compose interfaces with components, props, and state.')
  await expect(dialog).toContainText('JavaScript')
  await expect(dialog).toContainText('Locked')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('keyboard skill list opens a modal, traps focus and restores the opener', async ({ page }) => {
  await page.goto('/graph')
  const opener = page.getByRole('button', { name: 'Open CSS details', exact: true })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'CSS details', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'CSS', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(opener).toBeFocused()
})

test('zoom, pan and fit controls change the graph viewport', async ({ page }) => {
  await page.goto('/graph')
  const graph = page.getByRole('region', { name: 'Skill dependency graph', exact: true })
  const viewport = graph.locator('.react-flow__viewport')
  await expect(graph.locator('.react-flow__node')).toHaveCount(4)
  const initial = await viewport.getAttribute('style')
  await graph.getByRole('button', { name: /zoom in/i }).click()
  await expect(viewport).not.toHaveAttribute('style', initial!)
  await graph.getByRole('button', { name: /fit view/i }).click()
  const beforePan = await viewport.getAttribute('style')
  const pane = await graph.locator('.react-flow__pane').boundingBox()
  expect(pane).not.toBeNull()
  // Drag an empty lower corner, away from nodes and controls.
  await page.mouse.move(pane!.x + pane!.width - 30, pane!.y + pane!.height - 40)
  await page.mouse.down()
  await page.mouse.move(pane!.x + pane!.width - 110, pane!.y + pane!.height - 80, { steps: 8 })
  await page.mouse.up()
  await expect(viewport).not.toHaveAttribute('style', beforePan!)
  await graph.getByRole('button', { name: /fit view/i }).click()
  await expect(graph.locator('.react-flow__node[data-id="html"]')).toBeVisible()
})

test('verified state comes from the current user and path switching does not alter saved choices', async ({ page }) => {
  await page.route('**/src/services/index.ts', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'import { createMockService } from "/src/services/mockService.ts"; export const service = createMockService({ userId: "second-student" });',
  }))
  await page.goto('/graph?path=backend')
  const sql = page.getByRole('button', { name: 'Open SQL details', exact: true })
  await expect(sql).toContainText(/verified/i)
  const before = await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    return (await import(path)).service.getSelectedCareers()
  })
  await page.getByLabel('Career path', { exact: true }).selectOption('frontend')
  const after = await page.evaluate(async () => {
    const path = '/src/services/index.ts'
    return (await import(path)).service.getSelectedCareers()
  })
  expect(after).toEqual(before)
})

test('graph and keyboard alternative fit mobile, tablet and desktop widths', async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/graph')
    await expect(page.getByRole('button', { name: 'Open HTML details', exact: true })).toBeVisible()
    const zoom = await page.getByRole('button', { name: /zoom in/i }).boundingBox()
    expect(zoom?.width).toBeGreaterThanOrEqual(44)
    expect(zoom?.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Open HTML details', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'HTML details', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
  }
})

test('graph handles loading, empty and failed service reads', async ({ page }) => {
  await page.goto('/graph?mockLatencyMs=1000')
  await expect(page.getByRole('status')).toContainText('Loading career paths')
  await expect(page.getByRole('button', { name: 'Open HTML details', exact: true })).toBeVisible()
  await page.goto('/graph?mockScenario=empty')
  await expect(page.getByText('No career paths available.', { exact: true })).toBeVisible()
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
  await page.goto('/graph?mockScenario=error')
  await expect(page.getByRole('alert')).toContainText('Failed to load career paths')
  await expect(page.getByRole('button', { name: 'Retry loading', exact: true })).toBeVisible()
})
