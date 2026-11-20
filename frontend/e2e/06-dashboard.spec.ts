import { test, expect, reBrl, Dashboard, diaSP } from './support'

/** cenarios_testes.md — 3. Dashboard · Funcionalidade: Indicadores financeiros */
test.describe('Indicadores financeiros do dashboard @dashboard @financeiro', () => {
  test.describe('com o roteiro do dia D', () => {
    test.beforeEach(async ({ seed, page }) => {
      await test.step('Dado que foi executado o roteiro do dia D', async () => seed('dia-d'))
      await test.step('E abro o dashboard com o filtro "Hoje"', () => new Dashboard(page).abrir('Hoje'))
    })

    test('Faturamento bruto soma os subtotais antes do desconto', async ({ page }) => {
      await test.step('Então "Faturamento Bruto" deve ser R$ 79,50', () =>
        expect(new Dashboard(page).kpi('faturamento_bruto')).toHaveText(reBrl(79.5)))
    })

    test('Faturamento líquido é o bruto menos os descontos', async ({ page }) => {
      await test.step('Então "Fat. Líquido" deve ser R$ 70,50', () =>
        expect(new Dashboard(page).kpi('faturamento_liquido')).toHaveText(reBrl(70.5)))
    })

    test('Lucro bruto é o líquido menos o custo', async ({ page }) => {
      await test.step('Então "Lucro Bruto" deve ser R$ 38,50', () =>
        expect(new Dashboard(page).kpi('lucro_bruto')).toHaveText(reBrl(38.5)))
    })

    test('Margem média é lucro sobre faturamento líquido', async ({ page }) => {
      await test.step('Então "Margem Média" deve ser 54,6% (54,61% com 1 casa na tela)', () =>
        expect(new Dashboard(page).kpi('margem_media')).toHaveText('54.6%'))
    })

    test('Venda cancelada não entra em nenhum indicador', async ({ page, api }) => {
      const dash = new Dashboard(page)
      await test.step('Quando cancelo a venda V3 (R$ 22,50)', async () => {
        expect((await api.cancelarVenda(3)).status).toBe(200)
      })
      await test.step('E atualizo o dashboard', () => dash.abrir('Hoje'))
      await test.step('Então "Fat. Líquido" deve ser R$ 48,00', () => expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(48)))
      await test.step('E "Faturamento Bruto" deve ser R$ 54,50', () => expect(dash.kpi('faturamento_bruto')).toHaveText(reBrl(54.5)))
      await test.step('E "Qtd. Vendas" deve ser 2', () => expect(dash.kpi('quantidade_vendas')).toHaveText('2'))
    })
  })

  // Esquema do Cenário: Um valor vendido aparece integralmente no faturamento
  for (const valor of [1000, 0.02, 5.33]) {
    test(`Um valor vendido aparece integralmente no faturamento — R$ ${valor.toFixed(2).replace('.', ',')}`, async ({ page, seed, pdv }) => {
      const dash = new Dashboard(page)
      await test.step('Dado uma base sem vendas no dia', async () => seed('base'))
      await test.step(`Quando vendo R$ ${valor} sem desconto`, async () => {
        await pdv.abrirCaixa(100)
        await pdv.adicionarDiverso(valor)
        await pdv.pagar('PIX')
      })
      await dash.abrir('Hoje')
      await test.step(`Então "Faturamento Bruto" deve ser R$ ${valor}`, () => expect(dash.kpi('faturamento_bruto')).toHaveText(reBrl(valor)))
      await test.step(`E "Fat. Líquido" deve ser R$ ${valor}`, () => expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(valor)))
    })
  }

  test('Venda feita à noite (22:30) entra no dia certo pelo fuso de Brasília', async ({ page, seed }) => {
    const dash = new Dashboard(page)
    await test.step('Dado uma venda de R$ 10,00 feita ontem às 22:30 (horário de Brasília)', async () => seed('noite'))
    await dash.abrir('Hoje')
    await test.step('Quando filtro o dashboard pelo dia de ontem', () => dash.periodo(diaSP(-1), diaSP(-1)))
    await test.step('Então "Fat. Líquido" deve incluir os R$ 10,00', () => expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(10)))
    await test.step('E o filtro "Hoje" não deve incluir a venda', async () => {
      await dash.abrir('Hoje')
      await expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(0))
    })
  })
})

/** cenarios_testes.md — 4. Dashboard · Funcionalidade: Indicadores operacionais */
test.describe('Indicadores operacionais do dashboard @dashboard @operacional', () => {
  test.describe('com o roteiro do dia D', () => {
    test.beforeEach(async ({ seed, page }) => {
      await test.step('Dado que foi executado o roteiro do dia D', async () => seed('dia-d'))
      await test.step('E abro o dashboard com o filtro "Hoje"', () => new Dashboard(page).abrir('Hoje'))
    })

    test('Quantidade de vendas conta só as concluídas', async ({ page }) => {
      await test.step('Então "Qtd. Vendas" deve ser 3', () => expect(new Dashboard(page).kpi('quantidade_vendas')).toHaveText('3'))
    })

    test('Ticket médio é o faturamento líquido dividido pela quantidade de vendas', async ({ page }) => {
      await test.step('Então "Ticket Médio" deve ser R$ 23,50', () => expect(new Dashboard(page).kpi('ticket_medio')).toHaveText(reBrl(23.5)))
    })

    test('Custo total usa o custo do produto no momento da venda', async ({ page }) => {
      await test.step('Então "Custo Total" deve ser R$ 32,00', () => expect(new Dashboard(page).kpi('custo_total')).toHaveText(reBrl(32)))
    })

    test('Mudar o preço de custo depois não altera vendas passadas', async ({ page, api }) => {
      const dash = new Dashboard(page)
      await test.step('Quando altero o preço de custo do "Pão Francês" para R$ 10,00', async () => {
        const pao = await api.produto('Pão Francês')
        const r = await api.request.put(`${api.base}/produtos/${pao.id}`, { headers: await api.auth(), data: { preco_custo: 10 } })
        expect(r.ok()).toBe(true)
      })
      await test.step('E atualizo o dashboard', () => dash.abrir('Hoje'))
      await test.step('Então "Custo Total" deve continuar R$ 32,00', () => expect(dash.kpi('custo_total')).toHaveText(reBrl(32)))
    })

    test('Itens vendidos soma as quantidades', async ({ page }) => {
      await test.step('Então "Itens Vendidos" deve ser 8', () => expect(new Dashboard(page).kpi('itens_vendidos')).toHaveText('8'))
    })

    test('Recebimentos por maquineta', async ({ page }) => {
      const maq = new Dashboard(page).maquineta('1')
      await test.step('Então a "Maquineta 1" deve ter Débito 22,50, Crédito 0,00 e Total 22,50', async () => {
        await expect(maq).toBeVisible()
        await expect(maq).toContainText(/Total\s*R\$\s*22,50/)
        await expect(maq).toContainText(/Crédito\s*R\$\s*0,00/)
        await expect(maq).toContainText(/Débito\s*R\$\s*22,50/)
      })
    })
  })

  test('Itens vendidos não zera venda só por peso', async ({ page, seed, pdv }) => {
    test.fail(true, 'P5 — itens_vendidos é convertido para inteiro: 0,750 kg vira 0')
    const dash = new Dashboard(page)
    await test.step('Dado uma base sem vendas no dia', async () => seed('base'))
    await test.step('Quando vendo 0,500 kg de "Pão Francês" e 0,250 kg de "Mussarela"', async () => {
      await pdv.abrirCaixa(100)
      await pdv.adicionarPeso('Pão Francês', '500')
      await pdv.adicionarPeso('Mussarela', '250')
      await pdv.pagar('PIX')
    })
    await dash.abrir('Hoje')
    await test.step('Então "Itens Vendidos" não deve mostrar 0', () => expect(dash.kpi('itens_vendidos')).not.toHaveText('0', { timeout: 3000 }))
  })

  test('Filtro de caixa no dashboard', async () => {
    test.skip(true, 'P6 — o dashboard não tem filtro de caixa na tela (e o backend ignora caixa_id nos KPIs)')
  })
})
