import { expect, type Page } from '@playwright/test'
import { digitarValor } from './dinheiro'

/** Page object do /dashboard. */
export class Dashboard {
  constructor(readonly page: Page) {}

  /** Abre o dashboard no período informado e devolve o JSON que a tela recebeu. */
  async abrir(periodo: 'Hoje' | '7 dias' | '30 dias' | '90 dias' = 'Hoje') {
    await this.page.goto('/dashboard')
    await expect(this.kpi('faturamento_bruto')).toBeVisible()
    if (periodo !== '7 dias') {
      const resposta = this.page.waitForResponse(r => r.url().includes('/api/dashboard?'))
      await this.page.getByRole('button', { name: periodo, exact: true }).click()
      return (await resposta).json()
    }
  }

  /** Período personalizado (datas yyyy-MM-dd). */
  async periodo(de: string, ate: string) {
    await this.page.getByTitle('Selecionar período personalizado').click()
    const datas = this.page.locator('input[type="date"]')
    await datas.nth(1).fill(ate)
    const resposta = this.page.waitForResponse(r => r.url().includes(`data_inicio=${de}`))
    await datas.nth(0).fill(de)
    return (await resposta).json()
  }

  kpi(key: string) {
    return this.page.getByTestId(`kpi-${key}`).getByTestId('kpi-valor')
  }

  maquineta(numero: string) {
    return this.page.getByTestId('maquineta-card').filter({ hasText: `Maq. ${numero}` })
  }

  linhasAbc() {
    return this.page.getByTestId('abc-linha')
  }

  linhaAbc(produto: string) {
    return this.linhasAbc().filter({ hasText: produto })
  }
}

export { digitarValor }
