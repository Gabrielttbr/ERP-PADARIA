import { test, expect, reBrl, digitarValor, Dashboard, TelaCaixa, TelaRelatorios } from './support'

/**
 * Fluxo dourado: executa o roteiro do dia D (seção 0 do cenarios_testes.md) inteiro pela tela
 * e confere caixa, dashboard e relatório contra o gabarito. Prova que o seed "dia-d" usado nos
 * outros specs dá o mesmo resultado que a operação real no PDV.
 *
 * Diferenças inevitáveis: V3 usa desconto de R$ 2,50 (o PDV não tem desconto em %), e o
 * cancelamento da V4 é feito pela API (não há tela de cancelamento).
 */
test('Roteiro do dia D pelo PDV bate com o gabarito @roteiro @pdv @caixa @dashboard', async ({ page, seed, pdv, api }) => {
  test.setTimeout(120_000)
  seed('base')

  await test.step('Abertura do caixa com R$ 100,00', () => pdv.abrirCaixa(100))

  await test.step('V1: 0,500 kg Pão + 2 Café = R$ 18,00 — Dinheiro 20,00, troco 2,00', async () => {
    await pdv.adicionarPeso('Pão Francês', '500')
    await pdv.adicionar('Café Expresso', 2)
    await expect(pdv.total).toHaveText(reBrl(18))
    await pdv.abrirPagamento()
    await pdv.escolherForma('Dinheiro')
    await digitarValor(pdv.valorPagamento, 20)
    await expect(page.getByTestId('pagamento-troco')).toHaveText(reBrl(2))
    await pdv.confirmar()
  })

  await test.step('V2: 3 Bolo + 0,250 kg Mussarela = 36,50 − 6,50 = R$ 30,00 — PIX', async () => {
    await pdv.adicionar('Fatia de Bolo', 3)
    await pdv.adicionarPeso('Mussarela', '250')
    await pdv.desconto(6.5)
    await expect(pdv.total).toHaveText(reBrl(30))
    await pdv.pagar('PIX')
  })

  await test.step('V3: 1,250 kg Pão + 1 Café = 25,00 − 2,50 = R$ 22,50 — Débito, Maquineta 1', async () => {
    await pdv.adicionarPeso('Pão Francês', '1250')
    await pdv.adicionar('Café Expresso')
    await pdv.desconto(2.5)
    await expect(pdv.total).toHaveText(reBrl(22.5))
    await pdv.pagar('Débito')
  })

  await test.step('V4: 4 Café = R$ 20,00 — Dinheiro, depois cancelada (via API)', async () => {
    await pdv.adicionar('Café Expresso', 4)
    const resposta = page.waitForResponse(r => r.url().endsWith('/api/vendas') && r.request().method() === 'POST')
    await pdv.pagar('Dinheiro')
    const v4 = await (await resposta).json()
    expect((await api.cancelarVenda(v4.id, 'cliente desistiu')).status).toBe(200)
  })

  const caixa = new TelaCaixa(page)
  await test.step('Sangria de R$ 30,00 e suprimento de R$ 50,00', async () => {
    await caixa.abrir()
    await caixa.sangria(30)
    await expect(page.getByText('Sangria registrada')).toBeVisible()
    await caixa.suprimento(50)
    await expect(page.getByText('Suprimento registrado')).toBeVisible()
  })

  await test.step('Caixa: Dinheiro 18,00 · PIX 30,00 · Cartão 22,50 · Total 70,50 · Gaveta 138,00', async () => {
    await caixa.abrir()
    await expect(caixa.card('dinheiro')).toContainText(reBrl(18))
    await expect(caixa.card('pix')).toContainText(reBrl(30))
    await expect(caixa.card('cartao')).toContainText(reBrl(22.5))
    await expect(caixa.card('total')).toContainText(reBrl(70.5))
    await expect(caixa.esperado).toHaveText(reBrl(138))
  })

  await test.step('Dashboard "Hoje" bate com o gabarito', async () => {
    const dash = new Dashboard(page)
    await dash.abrir('Hoje')
    await expect(dash.kpi('faturamento_bruto')).toHaveText(reBrl(79.5))
    await expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(70.5))
    await expect(dash.kpi('custo_total')).toHaveText(reBrl(32))
    await expect(dash.kpi('lucro_bruto')).toHaveText(reBrl(38.5))
    await expect(dash.kpi('margem_media')).toHaveText('54.6%')
    await expect(dash.kpi('quantidade_vendas')).toHaveText('3')
    await expect(dash.kpi('ticket_medio')).toHaveText(reBrl(23.5))
    await expect(dash.kpi('itens_vendidos')).toHaveText('8')
  })

  await test.step('Relatório por produto bate com o gabarito', async () => {
    const rel = new TelaRelatorios(page)
    await rel.abrir('Relatório Dinâmico')
    await rel.escolher(['Produto', 'Quantidade', 'Faturamento', 'Custo', 'Nº de vendas'])
    await rel.gerar()
    const linhas = (await rel.tabela()).map(l => [l['Produto'], l['Quantidade'], l['Faturamento'], l['Custo'], l['Nº de vendas']])
    expect(linhas).toEqual([
      ['Café Expresso', '3 un', '15.00', '4.50', '2'],
      ['Fatia de Bolo', '3 un', '24.00', '9.00', '1'],
      ['Mussarela', '0,250 kg', '12.50', '8.00', '1'],
      ['Pão Francês', '1,750 kg', '28.00', '10.50', '2'],
    ])
  })

  await test.step('Fechamento contando R$ 138,00 na gaveta: diferença zero', async () => {
    await caixa.abrir()
    const resumo = await caixa.fechar(138)
    expect(Number(resumo.sessao.diferenca)).toBe(0)
    await expect(page.getByText(/Caixa fechado\. Diferença: R\$\s*0,00/)).toBeVisible()
  })
})
