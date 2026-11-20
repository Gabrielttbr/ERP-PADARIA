import { expect, type Page } from '@playwright/test'

const DIMENSOES = ['Dia', 'Categoria', 'Produto', 'Operador', 'Caixa', 'Cliente']
const METRICAS = ['Quantidade', 'Faturamento', 'Custo', 'Lucro', 'Nº de vendas', 'Ticket médio']
const PADRAO = new Set(['Produto', 'Quantidade', 'Faturamento'])

/** Page object do /relatorios. */
export class TelaRelatorios {
  private ativos = new Set(PADRAO)
  constructor(readonly page: Page) {}

  async abrir(aba: 'Relatório de Vendas' | 'Relatório Dinâmico') {
    await this.page.goto('/relatorios')
    await this.page.getByRole('button', { name: aba, exact: true }).click()
    this.ativos = new Set(PADRAO)
  }

  /** Deixa ativos exatamente os chips informados (dimensões + métricas, pelos rótulos da tela). */
  async escolher(chips: string[]) {
    const desejados = new Set(chips)
    for (const rotulo of [...DIMENSOES, ...METRICAS]) {
      if (desejados.has(rotulo) !== this.ativos.has(rotulo)) {
        await this.page.getByRole('button', { name: rotulo, exact: true }).click()
      }
    }
    this.ativos = desejados
  }

  /** Clica em "Gerar relatório"; com esperarResposta=false não aguarda a API (validação no próprio front). */
  async gerar(esperarResposta = true) {
    const resposta = esperarResposta ? this.page.waitForResponse(r => r.url().endsWith('/api/relatorios/dinamico')) : null
    await this.page.getByRole('button', { name: 'Gerar relatório' }).click()
    return resposta
  }

  /** Tabela do relatório como lista de objetos {cabeçalho: texto}. */
  async tabela(): Promise<Record<string, string>[]> {
    const tabela = this.page.locator('table')
    await expect(tabela).toBeVisible()
    const cabecalhos = await tabela.locator('thead th').allInnerTexts()
    const linhas = tabela.locator('tbody tr')
    const resultado: Record<string, string>[] = []
    for (let i = 0; i < await linhas.count(); i++) {
      const celulas = await linhas.nth(i).locator('td').allInnerTexts()
      // normaliza espaços (a tela usa espaço não separável entre número e unidade)
      const limpo = (t: string) => t.replace(/\s+/g, ' ').trim()
      resultado.push(Object.fromEntries(cabecalhos.map((c, j) => [limpo(c), limpo(celulas[j] ?? '')])))
    }
    return resultado
  }
}
