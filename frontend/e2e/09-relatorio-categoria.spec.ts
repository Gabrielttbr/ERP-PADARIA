import { test, expect, TelaRelatorios } from './support'

/** cenarios_testes.md — 7. Funcionalidade: Relatório de vendas por categoria */
test.describe('Relatório de vendas por categoria @relatorio @categoria', () => {
  test.beforeEach(async ({ seed }) => seed('dia-d'))

  test('Indicadores por categoria', async ({ page }) => {
    const rel = new TelaRelatorios(page)
    await test.step('Quando gero o relatório dinâmico por "categoria" com todas as métricas', async () => {
      await rel.abrir('Relatório Dinâmico')
      await rel.escolher(['Categoria', 'Quantidade', 'Faturamento', 'Custo', 'Lucro', 'Nº de vendas', 'Ticket médio'])
      await rel.gerar()
    })
    const linhas = await rel.tabela()
    await test.step('Então o relatório deve conter Frios, Lanchonete e Pães com os valores do gabarito', () => {
      const resumo = linhas.map(l => [l['Categoria'], l['Faturamento'], l['Custo'], l['Lucro'], l['Nº de vendas'], l['Ticket médio']])
      expect(resumo).toEqual([
        ['Frios', '12.50', '8.00', '4.50', '1', '12.50'],
        ['Lanchonete', '39.00', '13.50', '25.50', '3', '13.00'],
        ['Pães', '28.00', '10.50', '17.50', '2', '14.00'],
      ])
    })
    await test.step('E a quantidade por categoria deve ser 0,250 / 6 / 1,750', () => {
      // A tela mostra "un" para categoria mesmo quando os produtos são vendidos por kg (P14).
      expect(linhas.map(l => l['Quantidade'].replace(/\s*\w+$/, ''))).toEqual(['0,250', '6', '1,750'])
    })
    await test.step('E "Lanchonete" deve ter num_vendas 3 (cada venda contada uma vez)', () =>
      expect(linhas.find(l => l['Categoria'] === 'Lanchonete')!['Nº de vendas']).toBe('3'))
  })

  test('Categoria + produto (duas dimensões)', async ({ page }) => {
    const rel = new TelaRelatorios(page)
    await test.step('Quando gero o relatório por "categoria" e "produto"', async () => {
      await rel.abrir('Relatório Dinâmico')
      await rel.escolher(['Categoria', 'Produto', 'Faturamento'])
      await rel.gerar()
    })
    const linhas = await rel.tabela()
    const fat = (cat: string, prod: string) => linhas.find(l => l['Categoria'] === cat && l['Produto'] === prod)?.['Faturamento']
    await test.step('Então "Lanchonete / Café Expresso" deve ter faturamento R$ 15,00', () => expect(fat('Lanchonete', 'Café Expresso')).toBe('15.00'))
    await test.step('E "Lanchonete / Fatia de Bolo" deve ter faturamento R$ 24,00', () => expect(fat('Lanchonete', 'Fatia de Bolo')).toBe('24.00'))
  })

  test('Relatório sem dimensão ou métrica é recusado', async ({ page }) => {
    const rel = new TelaRelatorios(page)
    await rel.abrir('Relatório Dinâmico')
    await test.step('Quando gero o relatório sem escolher dimensão', async () => {
      await rel.escolher(['Quantidade', 'Faturamento'])
      await rel.gerar(false)
    })
    await test.step('Então devo ver "Escolha ao menos uma dimensão"', () => expect(page.getByText('Escolha ao menos uma dimensão')).toBeVisible())
  })
})
