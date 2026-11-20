import { test, expect, reBrl, linhaEstoque, consultarBanco, sessaoGravada, estoqueGravado } from './support'

/**
 * cenarios_testes.md — 1. PDV · Funcionalidade: Cancelamento de venda
 * Cancelar venda não tem tela no sistema: a ação vai pela API e o efeito é
 * conferido nas telas de Caixa e Estoque.
 */
test.describe('Cancelamento de venda @pdv @cancelamento', () => {
  test.beforeEach(async ({ seed }) => seed('dia-d'))

  test('Cancelar venda devolve o estoque e tira o valor do caixa', async ({ page, pdv, api }) => {
    test.info().annotations.push({ type: 'sem tela', description: 'Cancelamento feito pela API.' })

    await test.step('Dado que a sessão tem total de vendas R$ 70,50 e o "Café Expresso" tem 97 un', async () => {
      await page.goto('/caixa')
      await expect(page.getByTestId('caixa-total')).toContainText(reBrl(70.5))
      await expect(await linhaEstoque(page, 'Café Expresso')).toContainText('97 un')
    })

    let vendaId = 0
    await test.step('Quando finalizo uma venda de 4 "Café Expresso" (R$ 20,00)', async () => {
      await pdv.abrir()
      await pdv.adicionar('Café Expresso', 4)
      const resposta = page.waitForResponse(r => r.url().endsWith('/api/vendas') && r.request().method() === 'POST')
      await pdv.pagar('Dinheiro')
      vendaId = (await (await resposta).json()).id
    })
    await test.step('Então o total de vendas da sessão deve ser R$ 90,50', async () => {
      await page.goto('/caixa')
      await expect(page.getByTestId('caixa-total')).toContainText(reBrl(90.5))
    })
    await test.step('E o estoque do "Café Expresso" deve ser 93', async () => {
      await expect(await linhaEstoque(page, 'Café Expresso')).toContainText('93 un')
    })

    await test.step('Quando cancelo a venda com o motivo "cliente desistiu"', async () => {
      const r = await api.cancelarVenda(vendaId, 'cliente desistiu')
      expect(r.status).toBe(200)
      expect(r.body.status).toBe('cancelada')
    })
    await test.step('Então o total de vendas da sessão deve voltar a R$ 70,50', async () => {
      await page.goto('/caixa')
      await expect(page.getByTestId('caixa-total')).toContainText(reBrl(70.5))
    })
    await test.step('E o estoque do "Café Expresso" deve voltar a 97', async () => {
      await expect(await linhaEstoque(page, 'Café Expresso')).toContainText('97 un')
    })
    await test.step('E no banco: venda cancelada com motivo, sessão de volta a 70,50 e devolução 93 → 97', () => {
      expect(consultarBanco('select status, motivo_cancelamento from vendas where id = ?', [vendaId]))
        .toEqual([{ status: 'cancelada', motivo_cancelamento: 'cliente desistiu' }])
      expect(sessaoGravada().total_vendas).toBe(70.5)
      const { estoque, movimentacoes } = estoqueGravado('Café Expresso')
      expect(estoque).toBe(97)
      expect(movimentacoes.at(-1)).toEqual({ tipo: 'devolucao', quantidade: 4, saldo_antes: 93, saldo_depois: 97, referencia_id: vendaId })
    })
  })

  test('Não cancela uma venda já cancelada', async ({ api }) => {
    await test.step('Dado que a venda V4 está cancelada', async () => {})
    await test.step('Quando tento cancelar a venda V4 de novo', async () => {
      const r = await api.cancelarVenda(4)
      await test.step('Então devo receber erro "Venda com status \'cancelada\' não pode ser cancelada"', async () => {
        expect(r.status).toBe(422)
        expect(r.body.detail).toBe("Venda com status 'cancelada' não pode ser cancelada")
      })
    })
  })
})
