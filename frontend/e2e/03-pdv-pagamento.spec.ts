import { test, expect, reBrl, kpi, linhaEstoque, digitarValor } from './support'

/** cenarios_testes.md — 1. PDV · Funcionalidade: Pagamento e finalização */
test.describe('Pagamento e finalização @pdv @pagamento', () => {
  test.beforeEach(async ({ seed }) => seed('base'))

  test('Pagamento em dinheiro com troco', async ({ page, pdv }) => {
    await pdv.abrirCaixa(100)
    await test.step('Dado um carrinho de R$ 18,00', async () => {
      await pdv.adicionarPeso('Pão Francês', '500')
      await pdv.adicionar('Café Expresso', 2)
      await expect(pdv.total).toHaveText(reBrl(18))
    })
    await test.step('Quando pago R$ 20,00 em "Dinheiro"', async () => {
      await pdv.abrirPagamento()
      await pdv.escolherForma('Dinheiro')
      await digitarValor(pdv.valorPagamento, 20)
    })
    await test.step('Então o troco deve ser R$ 2,00', () => expect(page.getByTestId('pagamento-troco')).toHaveText(reBrl(2)))
    await test.step('E a venda deve ser concluída', () => pdv.confirmar())
  })

  test('Pagamento insuficiente é recusado', async ({ page, pdv }) => {
    test.fail(true, 'P12 — em dinheiro, valor menor que o total é aceito: o PDV envia max(valor digitado, total) e a venda é concluída')
    await pdv.abrirCaixa(100)
    await test.step('Dado um carrinho de R$ 18,00', async () => {
      await pdv.adicionarPeso('Pão Francês', '500')
      await pdv.adicionar('Café Expresso', 2)
    })
    await test.step('Quando pago R$ 15,00 em "Dinheiro"', async () => {
      await pdv.abrirPagamento()
      await pdv.escolherForma('Dinheiro')
      await digitarValor(pdv.valorPagamento, 15)
      const resposta = page.waitForResponse(r => r.url().endsWith('/api/vendas') && r.request().method() === 'POST', { timeout: 5000 }).catch(() => null)
      await page.getByRole('button', { name: 'Confirmar Venda' }).click()
      await resposta
    })
    await test.step('Então a venda deve ser recusada (nada entra no caixa)', async () => {
      await page.goto('/caixa')
      await expect(page.getByTestId('caixa-total')).toContainText(reBrl(0))
    })
  })

  test('Pagamento dividido em duas formas', async ({ page, pdv }) => {
    test.fail(true, 'P13 — o botão "Adicionar pagamento parcial" só aparece depois que já existe um pagamento; não há como lançar o primeiro')
    await pdv.abrirCaixa(100)
    await test.step('Dado um carrinho de R$ 50,00', async () => {
      await pdv.adicionar('Café Expresso')
      await pdv.qtdItem('Café Expresso').fill('10')
      await expect(pdv.total).toHaveText(reBrl(50))
    })
    await test.step('Quando pago R$ 20,00 em "PIX" e R$ 30,00 em "Cartão de Crédito"', async () => {
      await pdv.abrirPagamento()
      await pdv.escolherForma('PIX')
      await digitarValor(pdv.valorPagamento, 20)
      await expect(page.getByRole('button', { name: /Adicionar pagamento parcial/ }),
        'botão de pagamento parcial disponível antes do 1º pagamento').toBeVisible({ timeout: 3000 })
      await pdv.adicionarPagamentoParcial('PIX', 20)
      await pdv.adicionarPagamentoParcial('Crédito', 30)
      await pdv.confirmar()
    })
    await test.step('Então a venda deve ter 2 pagamentos que somam R$ 50,00 (tela do caixa)', async () => {
      await page.goto('/caixa')
      await expect(page.getByTestId('caixa-pix')).toContainText(reBrl(20))
      await expect(page.getByTestId('caixa-cartao')).toContainText(reBrl(30))
      await expect(page.getByTestId('caixa-total')).toContainText(reBrl(50))
    })
  })

  test('Cartão seleciona Maquineta 1 por padrão', async ({ page, pdv }) => {
    await pdv.abrirCaixa(100)
    await test.step('Dado um carrinho de R$ 22,50', async () => {
      await pdv.adicionarPeso('Pão Francês', '1250')
      await pdv.adicionar('Café Expresso')
      await pdv.desconto(2.5)
    })
    await test.step('Quando escolho a forma "Cartão de Débito"', async () => {
      await pdv.abrirPagamento()
      await pdv.escolherForma('Débito')
    })
    await test.step('Então a "Maquineta 1" deve estar selecionada', async () => {
      await expect(page.getByText('Selecione a maquineta para continuar')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Confirmar Venda' })).toBeEnabled()
    })
  })

  test('Finalizar venda baixa o estoque', async ({ page, pdv }) => {
    await pdv.abrirCaixa(100)
    await test.step('Dado que o "Pão Francês" tem 20,000 kg e o "Café Expresso" tem 100 un', async () => {})
    await test.step('Quando finalizo uma venda com 0,500 kg de "Pão Francês" e 2 "Café Expresso"', async () => {
      await pdv.adicionarPeso('Pão Francês', '500')
      await pdv.adicionar('Café Expresso', 2)
      await pdv.pagar('Dinheiro')
    })
    await test.step('Então o estoque do "Pão Francês" deve ser 19,500 kg', async () => {
      await expect(await linhaEstoque(page, 'Pão Francês')).toContainText('19.500 kg')
    })
    await test.step('E o estoque do "Café Expresso" deve ser 98', async () => {
      await expect(await linhaEstoque(page, 'Café Expresso')).toContainText('98 un')
    })
  })

  test('Venda acima do estoque é recusada', async ({ page, pdv, api }) => {
    await test.step('Dado que a "Mussarela" tem 0,200 kg em estoque', async () => {
      const m = await api.produto('Mussarela')
      const r = await api.post('/estoque/ajuste', { produto_id: m.id, tipo: 'ajuste', quantidade: 0.2, observacao: 'e2e' })
      expect(r.status).toBe(201)
    })
    await pdv.abrirCaixa(100)
    await test.step('Quando tento vender 0,250 kg de "Mussarela"', async () => {
      await pdv.adicionarPeso('Mussarela', '250')
      await pdv.pagar('Dinheiro', undefined, { esperarSucesso: false })
    })
    await test.step('Então a venda deve ser recusada com "Estoque insuficiente para \'Mussarela\'"', () =>
      expect(page.getByText("Estoque insuficiente para 'Mussarela'")).toBeVisible())
  })

  test('Produto "Diverso" (código 999) vende sem estoque', async ({ page, pdv }) => {
    await pdv.abrirCaixa(100)
    await test.step('Quando adiciono um item Diverso de R$ 7,00', async () => {
      await pdv.busca.fill('Diverso')
      await page.getByRole('button').filter({ hasText: 'Diverso' }).first().click()
      await digitarValor(page.getByTestId('diverso-preco'), 7)
      await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
      await expect(pdv.total).toHaveText(reBrl(7))
    })
    await test.step('E finalizo a venda', () => pdv.pagar('Dinheiro'))
    await test.step('Então a venda deve ser concluída com total R$ 7,00', async () => {
      await page.goto('/dashboard')
      await expect(kpi(page, 'faturamento_liquido')).toHaveText(reBrl(7))
    })
  })

  test('Não é possível vender sem caixa aberto', async ({ page, pdv }) => {
    await test.step('Dado que não existe sessão de caixa aberta', async () => {})
    await test.step('Quando abro o PDV', () => pdv.abrir())
    await test.step('Então devo ver a tela de abertura de caixa, e não o PDV', async () => {
      await expect(page.getByText('Informe o fundo de caixa para começar a vender')).toBeVisible()
      await expect(pdv.busca).toHaveCount(0)
    })
  })
})
