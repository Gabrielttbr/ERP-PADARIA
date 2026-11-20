import { expect, type Page } from '@playwright/test'
import { digitarValor } from './dinheiro'

export type NovoProduto = {
  nome: string; categoria: string; unidade: string
  custo: number; venda: number; estoque?: string; estoqueMinimo?: string
}

/** Page object do /estoque: produtos, ajustes e categorias. */
export class TelaEstoque {
  constructor(readonly page: Page) {}

  async abrir() {
    await this.page.goto('/estoque')
    await expect(this.page.getByRole('button', { name: '+ Novo Produto' })).toBeVisible()
  }

  linha(nome: string) {
    return this.page.getByRole('row').filter({ has: this.page.getByText(nome, { exact: true }) })
  }

  /** Preenche o formulário de produto (sem salvar). */
  async preencherProduto(p: NovoProduto) {
    await this.page.getByRole('button', { name: '+ Novo Produto' }).click()
    await this.page.getByPlaceholder('Ex: Pão Francês').fill(p.nome)
    await this.page.getByTestId('produto-categoria').selectOption({ label: p.categoria })
    await digitarValor(this.page.getByTestId('produto-preco-venda'), p.venda)
    await digitarValor(this.page.getByTestId('produto-preco-custo'), p.custo)
    await this.page.getByTestId('produto-unidade').selectOption(p.unidade)
    if (p.estoque) await this.page.getByTestId('produto-estoque').fill(p.estoque)
    if (p.estoqueMinimo) await this.page.getByTestId('produto-estoque-minimo').fill(p.estoqueMinimo)
  }

  async salvarProduto(mensagem = /Produto (cadastrado|atualizado)!/) {
    await this.page.getByTestId('produto-salvar').click()
    await expect(this.page.getByText(mensagem)).toBeVisible()
  }

  async editar(nome: string) {
    await this.linha(nome).getByTestId('acao-editar').click()
  }

  async ajustar(nome: string, tipo: 'entrada' | 'saida' | 'ajuste' | 'perda', quantidade: string) {
    await this.linha(nome).getByTestId('acao-ajuste').click()
    await this.page.getByTestId('ajuste-tipo').selectOption(tipo)
    await this.page.getByTestId('ajuste-quantidade').fill(quantidade)
    await this.page.getByTestId('ajuste-confirmar').click()
    await expect(this.page.getByText(/Estoque atualizado/)).toBeVisible()
  }

  // ── Categorias ──
  async abrirCategorias() {
    await this.page.getByRole('button', { name: 'Categorias', exact: true }).click()
    await expect(this.page.getByPlaceholder('Nova categoria...')).toBeVisible()
  }

  categoria(nome: string) {
    return this.page.locator(`[data-testid="categoria-item"][data-nome="${nome}"]`)
  }

  async criarCategoria(nome: string, pai?: string) {
    if (pai) await this.page.getByTestId('categoria-pai').selectOption({ label: pai })
    await this.page.getByPlaceholder('Nova categoria...').fill(nome)
    await this.page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  }
}
