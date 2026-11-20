import { test, expect, reBrl, vendaGravada, ultimaVendaId } from './support'

/**
 * cenarios_testes.md — 1. PDV · Funcionalidade: Carrinho do PDV
 * Contexto: sessão de caixa aberta e produtos da massa de dados cadastrados.
 */
test.describe('Carrinho do PDV @pdv', () => {
  test.beforeEach(async ({ seed, pdv }) => {
    await test.step('Dado que existe uma sessão de caixa aberta', async () => {
      seed('base')
      await pdv.abrirCaixa(100)
    })
  })

  test('Adicionar produto unitário soma no total', async ({ pdv }) => {
    await test.step('Quando adiciono 1 "Café Expresso" ao carrinho', () => pdv.adicionar('Café Expresso'))
    await test.step('Então o carrinho deve ter 1 item "Café Expresso" com quantidade 1', async () => {
      await expect(pdv.itens()).toHaveCount(1)
      await expect(pdv.qtdItem('Café Expresso')).toHaveValue('1')
    })
    await test.step('E o total do item deve ser R$ 5,00', () => expect(pdv.totalItem('Café Expresso')).toHaveText(reBrl(5)))
    await test.step('E o subtotal do carrinho deve ser R$ 5,00', () => expect(pdv.subtotal).toHaveText(reBrl(5)))
  })

  test('Adicionar o mesmo produto de novo incrementa a quantidade (não duplica linha)', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 1 "Café Expresso"', () => pdv.adicionar('Café Expresso'))
    await test.step('Quando adiciono 1 "Café Expresso" novamente', () => pdv.adicionar('Café Expresso'))
    await test.step('Então o carrinho deve ter apenas 1 linha de "Café Expresso"', () => expect(pdv.itens()).toHaveCount(1))
    await test.step('E a quantidade deve ser 2', () => expect(pdv.qtdItem('Café Expresso')).toHaveValue('2'))
    await test.step('E o subtotal deve ser R$ 10,00', () => expect(pdv.subtotal).toHaveText(reBrl(10)))
  })

  test('Botão "+" aumenta a quantidade de produto unitário', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 2 "Café Expresso"', () => pdv.adicionar('Café Expresso', 2))
    await test.step('Quando clico no botão "+" do item', () => pdv.mais('Café Expresso'))
    await test.step('Então a quantidade deve ser 3', () => expect(pdv.qtdItem('Café Expresso')).toHaveValue('3'))
    await test.step('E o subtotal deve ser R$ 15,00', () => expect(pdv.subtotal).toHaveText(reBrl(15)))
  })

  test('Botão "−" diminui a quantidade de produto unitário', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 3 "Café Expresso"', () => pdv.adicionar('Café Expresso', 3))
    await test.step('Quando clico no botão "−" do item', () => pdv.menos('Café Expresso'))
    await test.step('Então a quantidade deve ser 2', () => expect(pdv.qtdItem('Café Expresso')).toHaveValue('2'))
    await test.step('E o subtotal deve ser R$ 10,00', () => expect(pdv.subtotal).toHaveText(reBrl(10)))
  })

  test('Diminuir até zero remove o item do carrinho', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 1 "Café Expresso"', () => pdv.adicionar('Café Expresso'))
    await test.step('Quando clico no botão "−" do item', () => pdv.menos('Café Expresso'))
    await test.step('Então o item "Café Expresso" não deve mais estar no carrinho', () => expect(pdv.item('Café Expresso')).toHaveCount(0))
    await test.step('E o subtotal deve ser R$ 0,00', () => expect(pdv.subtotal).toHaveText(reBrl(0)))
  })

  test('Produto por kg abre o modal de peso', async ({ page, pdv }) => {
    await test.step('Quando seleciono o produto "Pão Francês"', async () => {
      await pdv.busca.fill('Pão Francês')
      await page.getByRole('button').filter({ hasText: 'Pão Francês' }).first().click()
    })
    const campo = page.getByTestId('peso-valor')
    await test.step('Então o modal de peso deve ser exibido', () => expect(campo).toBeVisible())
    await test.step('Quando informo o peso 0,500 kg e confirmo', async () => {
      for (const d of '500') await campo.press(d)
      await campo.press('Enter')
    })
    await test.step('Então o carrinho deve ter "Pão Francês" com quantidade "0,500 kg"', () =>
      expect(pdv.qtdItem('Pão Francês')).toHaveValue('0,500'))
    await test.step('E o total do item deve ser R$ 8,00', () => expect(pdv.totalItem('Pão Francês')).toHaveText(reBrl(8)))
  })

  // Esquema do Cenário: Valor do item por kg acompanha o peso informado
  const exemplos = [
    { produto: 'Pão Francês', peso: '0,500', digitos: '500', total: 8.0 },
    { produto: 'Pão Francês', peso: '1,250', digitos: '1250', total: 20.0 },
    { produto: 'Pão Francês', peso: '0,333', digitos: '333', total: 5.33 },
    { produto: 'Pão Francês', peso: '0,001', digitos: '1', total: 0.02 },
    { produto: 'Mussarela', peso: '0,250', digitos: '250', total: 12.5 },
    { produto: 'Mussarela', peso: '0,175', digitos: '175', total: 8.75 },
  ]
  for (const ex of exemplos) {
    test(`Valor do item por kg acompanha o peso informado — ${ex.produto} ${ex.peso} kg`, async ({ pdv }) => {
      await test.step(`Quando adiciono "${ex.produto}" com peso ${ex.peso} kg`, () => pdv.adicionarPeso(ex.produto, ex.digitos))
      await test.step(`Então o total do item deve ser R$ ${ex.total.toFixed(2).replace('.', ',')}`, () =>
        expect(pdv.totalItem(ex.produto)).toHaveText(reBrl(ex.total)))
    })
  }

  test('Botão "+" em produto por kg soma 1 grama (0,001 kg)', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 0,500 kg de "Pão Francês"', () => pdv.adicionarPeso('Pão Francês', '500'))
    await test.step('Quando clico no botão "+" do item', () => pdv.mais('Pão Francês'))
    await test.step('Então a quantidade deve ser "0,501 kg"', () => expect(pdv.qtdItem('Pão Francês')).toHaveValue('0,501'))
    await test.step('E o total do item deve ser R$ 8,02', () => expect(pdv.totalItem('Pão Francês')).toHaveText(reBrl(8.02)))
  })

  test('Botão "−" em produto por kg tira 1 grama (0,001 kg)', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 0,500 kg de "Pão Francês"', () => pdv.adicionarPeso('Pão Francês', '500'))
    await test.step('Quando clico no botão "−" do item', () => pdv.menos('Pão Francês'))
    await test.step('Então a quantidade deve ser "0,499 kg"', () => expect(pdv.qtdItem('Pão Francês')).toHaveValue('0,499'))
    await test.step('E o total do item deve ser R$ 7,98', () => expect(pdv.totalItem('Pão Francês')).toHaveText(reBrl(7.98)))
  })

  test('Editar o peso digitando direto no carrinho', async ({ pdv }) => {
    await test.step('Dado que o carrinho tem 0,500 kg de "Pão Francês"', () => pdv.adicionarPeso('Pão Francês', '500'))
    await test.step('Quando edito a quantidade para "1,250"', async () => {
      await pdv.qtdItem('Pão Francês').fill('1,250')
      await pdv.qtdItem('Pão Francês').press('Enter')
    })
    await test.step('Então o total do item deve ser R$ 20,00', () => expect(pdv.totalItem('Pão Francês')).toHaveText(reBrl(20)))
  })

  test('Total do carrinho com itens unitários e por kg', async ({ pdv }) => {
    await test.step('Quando adiciono 0,500 kg de "Pão Francês"', () => pdv.adicionarPeso('Pão Francês', '500'))
    await test.step('E adiciono 2 "Café Expresso"', () => pdv.adicionar('Café Expresso', 2))
    await test.step('Então o subtotal deve ser R$ 18,00', () => expect(pdv.subtotal).toHaveText(reBrl(18)))
  })

  test('Carrinho e venda gravada mostram o mesmo valor (arredondamento)', async ({ page, pdv }) => {
    await test.step('Quando adiciono 0,333 kg de "Pão Francês"', () => pdv.adicionarPeso('Pão Francês', '333'))
    await test.step('Então o total exibido no carrinho deve ser R$ 5,33', () => expect(pdv.total).toHaveText(reBrl(5.33)))
    await test.step('E finalizo a venda em dinheiro', () => pdv.pagar('Dinheiro'))
    await test.step('Então o total gravado na venda deve ser R$ 5,33 (Fat. Líquido do dia)', async () => {
      await page.goto('/dashboard')
      await expect(page.getByTestId('kpi-faturamento_liquido').getByTestId('kpi-valor')).toHaveText(reBrl(5.33))
    })
    await test.step('E no banco: item 0,333 kg a R$ 16,00 = R$ 5,33, pagamento R$ 5,33', () => {
      const { venda, itens, pagamentos } = vendaGravada(ultimaVendaId())
      expect(venda).toMatchObject({ status: 'concluida', subtotal: 5.33, total: 5.33, troco: 0 })
      expect(itens).toEqual([{ produto: 'Pão Francês', quantidade: 0.333, preco_unit: 16, custo_unit: 6, total_item: 5.33 }])
      expect(pagamentos).toEqual([{ forma: 'dinheiro', valor: 5.33, nsu: null }])
    })
  })
})
