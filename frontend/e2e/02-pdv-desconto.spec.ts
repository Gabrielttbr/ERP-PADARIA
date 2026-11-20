import { test, expect, reBrl, kpi, linhaEstoque, consultarBanco, vendaGravada, ultimaVendaId } from './support'

/** cenarios_testes.md — 1. PDV · Funcionalidade: Desconto na venda */
test.describe('Desconto na venda @pdv @desconto', () => {
  test.beforeEach(async ({ seed, pdv }) => {
    seed('base')
    await pdv.abrirCaixa(100)
  })

  test('Desconto em valor reduz o total', async ({ pdv }) => {
    await test.step('Dado um carrinho com 3 "Fatia de Bolo" e 0,250 kg de "Mussarela"', async () => {
      await pdv.adicionar('Fatia de Bolo', 3)
      await pdv.adicionarPeso('Mussarela', '250')
    })
    await test.step('Quando aplico desconto de R$ 6,50', () => pdv.desconto(6.5))
    await test.step('Então o subtotal deve ser R$ 36,50', () => expect(pdv.subtotal).toHaveText(reBrl(36.5)))
    await test.step('E o desconto deve ser R$ 6,50', () => expect(pdv.page.getByTestId('cart-desconto')).toHaveText(reBrl(6.5)))
    await test.step('E o total deve ser R$ 30,00', () => expect(pdv.total).toHaveText(reBrl(30)))
    await test.step('E, ao finalizar no PIX, o banco grava subtotal 36,50, desconto 6,50 e total 30,00', async () => {
      await pdv.pagar('PIX')
      const { venda, pagamentos } = vendaGravada(ultimaVendaId())
      expect(venda).toMatchObject({ status: 'concluida', subtotal: 36.5, desconto_valor: 6.5, total: 30, troco: 0 })
      expect(pagamentos).toEqual([{ forma: 'pix', valor: 30, nsu: null }])
    })
  })

  test('Desconto percentual reduz o total (sem tela: ação via API)', async ({ page, api }) => {
    test.info().annotations.push({ type: 'sem tela', description: 'O PDV só aceita desconto em R$; a venda com % é feita pela API.' })
    let venda: any
    await test.step('Dado um carrinho com 1,250 kg de "Pão Francês" e 1 "Café Expresso"', async () => {})
    await test.step('Quando aplico desconto de 10%', async () => {
      const r = await api.venderComDescontoPct(
        [{ nome: 'Pão Francês', qtd: 1.25 }, { nome: 'Café Expresso', qtd: 1 }], 10,
        { forma: 'cartao_debito', valor: 22.5 },
      )
      expect(r.status).toBe(201)
      venda = r.body
    })
    await test.step('Então o desconto calculado deve ser R$ 2,50', () => expect(Number(venda.desconto_valor)).toBe(2.5))
    await test.step('E no banco: desconto 2,50 (10%) e total 22,50', () =>
      expect(consultarBanco('select desconto_pct, desconto_valor, total from vendas where id = ?', [venda.id]))
        .toEqual([{ desconto_pct: 10, desconto_valor: 2.5, total: 22.5 }]))
    await test.step('E o total deve ser R$ 22,50 (conferido no dashboard)', async () => {
      await page.goto('/dashboard')
      await expect(kpi(page, 'faturamento_bruto')).toHaveText(reBrl(25))
      await expect(kpi(page, 'faturamento_liquido')).toHaveText(reBrl(22.5))
    })
  })

  test('Desconto maior que o subtotal é recusado', async ({ page, pdv }) => {
    await test.step('Dado um carrinho com 1 "Café Expresso"', () => pdv.adicionar('Café Expresso'))
    await test.step('Quando tento aplicar desconto de R$ 6,00', () => pdv.desconto(6))
    await test.step('Então o desconto deve ser recusado com "Desconto não pode ser maior que o subtotal"', async () => {
      await expect(page.getByText('Desconto não pode ser maior que o subtotal')).toBeVisible()
      await expect(pdv.total).toHaveText(reBrl(5))
    })
    await test.step('E o PDV continua na tela, com o carrinho (P10: antes ficava em branco)', async () => {
      await expect(pdv.busca).toBeVisible()
      await expect(pdv.item('Café Expresso')).toHaveCount(1)
    })
    await test.step('E nenhuma venda foi gravada', () => expect(consultarBanco('select count(*) as n from vendas')).toEqual([{ n: 0 }]))
    await test.step('E o estoque do "Café Expresso" não deve mudar', async () => {
      const linha = await linhaEstoque(page, 'Café Expresso')
      await expect(linha).toContainText('100 un')
    })
  })

  test('Remover o desconto volta ao total cheio', async ({ pdv }) => {
    await test.step('Dado um carrinho de R$ 36,50 com desconto de R$ 6,50', async () => {
      await pdv.adicionar('Fatia de Bolo', 3)
      await pdv.adicionarPeso('Mussarela', '250')
      await pdv.desconto(6.5)
      await expect(pdv.total).toHaveText(reBrl(30))
    })
    await test.step('Quando removo o desconto', () => pdv.desconto(0))
    await test.step('Então o total deve ser R$ 36,50', () => expect(pdv.total).toHaveText(reBrl(36.5)))
  })

  test('Erro de validação da API mostra a mensagem e não quebra a tela (P10)', async ({ page, pdv }) => {
    await test.step('Dado um carrinho de R$ 5,00 com desconto de R$ 5,00 (total zero)', async () => {
      await pdv.adicionar('Café Expresso')
      await pdv.desconto(5)
      await expect(pdv.total).toHaveText(reBrl(0))
    })
    await test.step('Quando tento finalizar (a API recusa com erro de validação 422 em lista)', async () => {
      const resposta = page.waitForResponse(r => r.url().endsWith('/api/vendas') && r.request().method() === 'POST')
      await pdv.pagar('Dinheiro', undefined, { esperarSucesso: false })
      expect((await resposta).status()).toBe(422)
    })
    await test.step('Então vejo a mensagem da API em texto', () =>
      expect(page.getByText('Valor do pagamento deve ser positivo')).toBeVisible())
    await test.step('E o PDV continua funcionando (antes ficava com a tela branca)', async () => {
      await expect(page.getByText('Total a pagar')).toBeVisible()
      await expect(pdv.item('Café Expresso')).toHaveCount(1)
    })
  })
})
