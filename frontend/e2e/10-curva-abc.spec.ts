import { test, expect, reBrl, Dashboard } from './support'

/**
 * cenarios_testes.md — 8. Funcionalidade: Curva ABC e Top produtos
 * P3 (não corrigido): a curva soma itens de vendas canceladas e de fora do período,
 * então os cenários abaixo são falhas esperadas até o P3 ser corrigido.
 */
const P3 = 'P3 — curva ABC soma itens de vendas canceladas e de outros períodos (filtro no JOIN de Venda)'

test.describe('Curva ABC e Top produtos @dashboard @curva-abc', () => {
  test.beforeEach(async ({ seed, page }) => {
    await test.step('Dado que foi executado o roteiro do dia D', async () => seed('dia-d'))
    await test.step('E abro o dashboard com o filtro "Hoje"', () => new Dashboard(page).abrir('Hoje'))
  })

  test('Classificação ABC do dia', async ({ page }) => {
    test.fail(true, P3)
    const dash = new Dashboard(page)
    await test.step('Então a curva ABC deve ser Pão A, Bolo A, Café B, Mussarela C', async () => {
      const esperado = [
        ['Pão Francês', 28, '35.22%', 'Classe A'],
        ['Fatia de Bolo', 24, '30.19%', 'Classe A'],
        ['Café Expresso', 15, '18.87%', 'Classe B'],
        ['Mussarela', 12.5, '15.72%', 'Classe C'],
      ] as const
      for (const [i, [produto, receita, pct, classe]] of esperado.entries()) {
        const linha = dash.linhasAbc().nth(i)
        await expect(linha).toContainText(produto, { timeout: 3000 })
        await expect(linha).toContainText(reBrl(receita))
        await expect(linha).toContainText(pct)
        await expect(linha).toContainText(classe)
      }
    })
  })

  test('Top 3 mostra os medalhistas na ordem', async ({ page }) => {
    test.fail(true, P3)
    const dash = new Dashboard(page)
    await test.step('Então 🥇 Pão Francês, 🥈 Fatia de Bolo e 🥉 Café Expresso', async () => {
      await expect(dash.linhasAbc().nth(0)).toContainText(/🥇\s*Pão Francês/, { timeout: 3000 })
      await expect(dash.linhasAbc().nth(1)).toContainText(/🥈\s*Fatia de Bolo/)
      await expect(dash.linhasAbc().nth(2)).toContainText(/🥉\s*Café Expresso/)
    })
  })

  test('Vendas fora do período não entram na curva', async ({ page, seed }) => {
    test.fail(true, P3)
    const dash = new Dashboard(page)
    await test.step('Dado uma venda de R$ 10,00 de "Café Expresso" no dia D-1', async () => seed('dia-d-e-ontem'))
    await test.step('Quando abro o dashboard com o filtro "Hoje"', () => dash.abrir('Hoje'))
    await test.step('Então o "Café Expresso" deve continuar com a receita do dia (R$ 15,00)', () =>
      expect(dash.linhaAbc('Café Expresso')).toContainText(reBrl(15), { timeout: 3000 }))
  })

  test('Soma da curva bate com os relatórios', async ({ page }) => {
    test.fail(true, P3)
    let dados: any
    await test.step('Quando leio a curva ABC que a tela recebeu', async () => { dados = await new Dashboard(page).abrir('Hoje') })
    await test.step('Então a soma do faturamento da curva ABC deve ser R$ 79,50', () => {
      const soma = dados.curva_abc.reduce((t: number, i: any) => t + Number(i.faturamento), 0)
      expect(soma).toBeCloseTo(79.5, 2)
    })
  })
})
