import { test, expect } from './support'

test('smoke: admin logado vê o dashboard @smoke', async ({ page, seed }) => {
  seed('base')
  await page.goto('/dashboard')
  await expect(page.getByTestId('kpi-faturamento_bruto')).toBeVisible()
})
