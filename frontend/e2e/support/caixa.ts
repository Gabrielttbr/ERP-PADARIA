import { expect, type Page } from '@playwright/test'
import { digitarValor } from './dinheiro'

/** Page object da tela /caixa: sangria, suprimento e fechamento. */
export class TelaCaixa {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.goto('/caixa')
    await expect(this.page.getByText('Controle de Caixa')).toBeVisible()
  }

  card(forma: 'dinheiro' | 'pix' | 'cartao' | 'total') { return this.page.getByTestId(`caixa-${forma}`) }
  get gaveta() { return this.page.getByTestId('resumo-gaveta') }
  get esperado() { return this.page.getByTestId('gaveta-esperado') }

  linhaGaveta(rotulo: string) {
    return this.gaveta.locator('div.flex').filter({ hasText: rotulo }).first()
  }

  private async movimento(botao: string, testId: string, valor: number, motivo: string, placeholder: RegExp, confirmar: string) {
    await this.page.getByRole('button', { name: botao, exact: true }).click()
    await digitarValor(this.page.getByTestId(testId), valor)
    await this.page.getByPlaceholder(placeholder).fill(motivo)
    await this.page.getByRole('button', { name: confirmar }).click()
  }

  sangria(valor: number, motivo = 'depósito') {
    return this.movimento('Sangria', 'sangria-valor', valor, motivo, /Pagamento de fornecedor/, 'Confirmar Sangria')
  }

  suprimento(valor: number, motivo = 'troco') {
    return this.movimento('Suprimento', 'suprimento-valor', valor, motivo, /Troco para o turno/, 'Confirmar Suprimento')
  }

  /** Fecha o caixa informando o valor contado; devolve o JSON do resumo de fechamento. */
  async fechar(contado: number) {
    await this.page.getByRole('button', { name: 'Fechar Caixa', exact: true }).click()
    await digitarValor(this.page.getByTestId('fechamento-valor'), contado)
    const resposta = this.page.waitForResponse(r => /\/api\/caixa\/\d+\/fechar$/.test(r.url()))
    await this.page.getByRole('button', { name: 'Confirmar Fechamento' }).click()
    return (await resposta).json()
  }
}
