import { expect, type Page } from '@playwright/test'

/** Linha do produto na tabela do Estoque (/estoque). */
export async function linhaEstoque(page: Page, nome: string) {
  await page.goto('/estoque')
  const linha = page.getByRole('row').filter({ hasText: nome })
  await expect(linha.first()).toBeVisible()
  return linha.first()
}

/** Valor exibido num card de KPI do dashboard (key do KPI_CONFIG). */
export function kpi(page: Page, key: string) {
  return page.getByTestId(`kpi-${key}`).getByTestId('kpi-valor')
}
