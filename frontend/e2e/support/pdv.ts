import { expect, type Page, type Locator } from '@playwright/test'
import { digitarValor, INTERVALO_TECLA_MS } from './dinheiro'

type Forma = 'Dinheiro' | 'Crédito' | 'Débito' | 'PIX'

/** Page object do PDV (/pdv): abertura de caixa, carrinho e pagamento. */
export class Pdv {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.goto('/pdv')
  }

  /** Abre o caixa pela tela do SessaoGuard (Enter confirma). */
  async abrirCaixa(valor: number) {
    await this.abrir()
    const campo = this.page.getByTestId('abertura-valor')
    await digitarValor(campo, valor)
    await campo.press('Enter')
    await expect(this.busca).toBeVisible()
  }

  get busca(): Locator {
    return this.page.getByPlaceholder(/Bipe o código de barras/)
  }

  card(nome: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${nome.charAt(0)}${nome}`) })
  }

  /** Clica no card do produto (unitário). */
  async adicionar(nome: string, vezes = 1) {
    for (let i = 0; i < vezes; i++) {
      await this.busca.fill(nome)
      await this.page.getByRole('button').filter({ hasText: nome }).first().click()
    }
  }

  /** Produto por kg: abre o modal de peso e digita os gramas ("500" = 0,500 kg). */
  async adicionarPeso(nome: string, digitos: string) {
    await this.busca.fill(nome)
    await this.page.getByRole('button').filter({ hasText: nome }).first().click()
    const campo = this.page.getByTestId('peso-valor')
    await expect(campo).toBeVisible()
    for (const d of digitos) {
      await campo.press(d)
      await this.page.waitForTimeout(INTERVALO_TECLA_MS)
    }
    await campo.press('Enter')
    await expect(campo).toBeHidden()
  }

  item(nome: string): Locator {
    return this.page.locator(`[data-testid="cart-item"][data-nome="${nome}"]`)
  }

  itens(): Locator {
    return this.page.getByTestId('cart-item')
  }

  async mais(nome: string) { await this.item(nome).getByTestId('cart-mais').click() }
  async menos(nome: string) { await this.item(nome).getByTestId('cart-menos').click() }

  totalItem(nome: string) { return this.item(nome).getByTestId('cart-item-total') }
  qtdItem(nome: string) { return this.item(nome).getByTestId('cart-item-qtd') }
  get subtotal() { return this.page.getByTestId('cart-subtotal') }
  get total() { return this.page.getByTestId('cart-total') }

  /** Desconto em R$ (F9). O PDV não tem desconto em %. */
  async desconto(valor: number) {
    await this.busca.click()
    await this.page.keyboard.press('F9')
    const campo = this.page.getByTestId('desconto-valor')
    await digitarValor(campo, valor)
    await campo.press('Enter')
  }

  async abrirPagamento() {
    await this.page.getByRole('button', { name: /Finalizar venda/ }).click()
    await expect(this.page.getByText('Total a pagar')).toBeVisible()
  }

  async escolherForma(forma: Forma) {
    await this.page.getByRole('button', { name: forma, exact: true }).click()
  }

  get valorPagamento() { return this.page.getByTestId('pagamento-valor') }

  /** Pagamento único: escolhe a forma, digita o valor (se informado) e confirma. */
  async pagar(forma: Forma, valor?: number, opcoes: { esperarSucesso?: boolean } = {}) {
    await this.abrirPagamento()
    await this.escolherForma(forma)
    if (valor !== undefined) await digitarValor(this.valorPagamento, valor)
    await this.confirmar(opcoes.esperarSucesso ?? true)
  }

  async adicionarPagamentoParcial(forma: Forma, valor: number) {
    await this.escolherForma(forma)
    await digitarValor(this.valorPagamento, valor)
    await this.page.getByRole('button', { name: /Adicionar pagamento parcial/ }).click()
  }

  /** Item Diverso (código 999) com preço livre. */
  async adicionarDiverso(valor: number) {
    await this.busca.fill('Diverso')
    await this.page.getByRole('button').filter({ hasText: 'Diverso' }).first().click()
    await digitarValor(this.page.getByTestId('diverso-preco'), valor)
    await this.page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  }

  async confirmar(esperarSucesso = true) {
    await this.page.getByRole('button', { name: 'Confirmar Venda' }).click()
    if (esperarSucesso) await expect(this.page.getByText('Venda concluída!')).toBeVisible()
  }
}
