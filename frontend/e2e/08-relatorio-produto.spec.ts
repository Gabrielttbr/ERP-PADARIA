import { test, expect, TelaRelatorios } from './support'

/**
 * cenarios_testes.md — 6. Funcionalidade: Relatório de vendas por produto
 * Faturamento = soma dos itens, antes do desconto geral da venda → soma bate com o Faturamento Bruto.
 * A tela mostra valores monetários sem formatação ("15.00").
 */
test.describe('Relatório de vendas por produto @relatorio @produto', () => {
  let linhas: Record<string, string>[]

  test.beforeEach(async ({ page, seed }) => {
    await test.step('Dado que foi executado o roteiro do dia D', async () => seed('dia-d'))
    await test.step('Quando gero o relatório dinâmico por "produto" com todas as métricas', async () => {
      const rel = new TelaRelatorios(page)
      await rel.abrir('Relatório Dinâmico')
      await rel.escolher(['Produto', 'Quantidade', 'Faturamento', 'Custo', 'Lucro', 'Nº de vendas', 'Ticket médio'])
      await rel.gerar()
      linhas = await rel.tabela()
    })
  })

  test('Indicadores por produto', async () => {
    await test.step('Então o relatório deve conter os indicadores do gabarito', () => {
      const resumo = linhas.map(l => [l['Produto'], l['Quantidade'], l['Faturamento'], l['Custo'], l['Lucro'], l['Nº de vendas'], l['Ticket médio']])
      expect(resumo).toEqual([
        ['Café Expresso', '3 un', '15.00', '4.50', '10.50', '2', '7.50'],
        ['Fatia de Bolo', '3 un', '24.00', '9.00', '15.00', '1', '24.00'],
        ['Mussarela', '0,250 kg', '12.50', '8.00', '4.50', '1', '12.50'],
        ['Pão Francês', '1,750 kg', '28.00', '10.50', '17.50', '2', '14.00'],
      ])
    })
  })

  test('Venda cancelada não entra no relatório por produto', async () => {
    await test.step('Então o "Café Expresso" deve ter quantidade 3 (e não 7)', () =>
      expect(linhas.find(l => l['Produto'] === 'Café Expresso')!['Quantidade']).toBe('3 un'))
  })

  test('Soma do relatório bate com o dashboard', async () => {
    const soma = (col: string) => linhas.reduce((t, l) => t + Number(l[col]), 0)
    await test.step('Então a soma do faturamento dos produtos deve ser R$ 79,50 (= Faturamento Bruto)', () => expect(soma('Faturamento')).toBeCloseTo(79.5, 2))
    await test.step('E a soma do custo deve ser R$ 32,00 (= Custo Total)', () => expect(soma('Custo')).toBeCloseTo(32, 2))
  })

  test('Produto por kg mostra a unidade', async () => {
    await test.step('Então a linha "Pão Francês" deve mostrar unidade "kg"', () =>
      expect(linhas.find(l => l['Produto'] === 'Pão Francês')!['Quantidade']).toMatch(/kg$/))
  })

  test('Filtrar por um produto', async () => {
    test.skip(true, 'Sem tela: o relatório dinâmico não tem filtro por produto (só a API aceita produto_id)')
  })
})
