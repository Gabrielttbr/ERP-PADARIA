import { test, expect } from './e2e/support'

/**
 * Seed para os agentes Playwright (planner/generator/healer): banco no estado
 * "base" do cenarios_testes.md e admin já logado (storageState).
 */
test.describe('Test group', () => {
  test('seed', async ({ page, seed }) => {
    seed('base')
    await page.goto('/dashboard')
    await expect(page.getByText('Faturamento Bruto').first()).toBeVisible()
  })
})
