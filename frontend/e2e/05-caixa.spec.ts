import { test, expect, reBrl, kpi, TelaCaixa, consultarBanco, sessaoGravada } from './support'

/** cenarios_testes.md — 2. Caixa · Funcionalidade: Sessão de caixa */
test.describe('Sessão de caixa @caixa', () => {
  test.beforeEach(async ({ seed }) => seed('base'))

  test('Abrir caixa com valor inicial', async ({ page, pdv }) => {
    const caixa = new TelaCaixa(page)
    await test.step('Quando abro o "Caixa 01" com R$ 100,00', () => pdv.abrirCaixa(100))
    await test.step('Então a sessão deve ficar com status "aberto"', async () => {
      await caixa.abrir()
      await expect(page.getByText('Aberto', { exact: true })).toBeVisible()
      await expect(page.getByText('Caixa 01')).toBeVisible()
    })
    await test.step('E o valor de abertura deve ser R$ 100,00', () => expect(caixa.linhaGaveta('Fundo inicial')).toContainText(reBrl(100)))
    await test.step('E o total de vendas deve ser R$ 0,00', () => expect(caixa.card('total')).toContainText(reBrl(0)))
  })

  test('Tecla Enter abre o caixa', async ({ page, pdv }) => {
    await test.step('Dado que estou na tela de abertura de caixa', async () => {
      await pdv.abrir()
      await expect(page.getByText('Informe o fundo de caixa para começar a vender')).toBeVisible()
    })
    await test.step('Quando digito R$ 100,00 e pressiono Enter / Então a sessão deve ser aberta', () => pdv.abrirCaixa(100))
  })

  test('Não abre duas sessões no mesmo caixa (sem tela: via API)', async ({ pdv, api }) => {
    test.info().annotations.push({ type: 'sem tela', description: 'O PDV reaproveita a sessão aberta; a 2ª abertura só é possível pela API.' })
    await test.step('Dado que o "Caixa 01" já está aberto', () => pdv.abrirCaixa(100))
    await test.step('Quando tento abrir o "Caixa 01" novamente', async () => {
      const caixas = await api.get('/caixa/caixas')
      const r = await api.post('/caixa/abrir', { caixa_id: caixas.find((c: any) => c.nome === 'Caixa 01').id, valor_abertura: 50 })
      await test.step('Então devo receber erro "Caixa já possui sessão aberta"', async () => {
        expect(r.status).toBe(409)
        expect(r.body.detail).toContain('Caixa já possui sessão aberta')
      })
    })
  })

  test('Sangria e suprimento atualizam os totais', async ({ page, pdv }) => {
    const caixa = new TelaCaixa(page)
    await test.step('Dado que o caixa foi aberto com R$ 100,00', () => pdv.abrirCaixa(100))
    await caixa.abrir()
    await test.step('Quando registro uma sangria de R$ 30,00 com motivo "depósito"', async () => {
      await caixa.sangria(30, 'depósito')
      await expect(page.getByText('Sangria registrada')).toBeVisible()
    })
    await test.step('E registro um suprimento de R$ 50,00 com motivo "troco"', async () => {
      await caixa.suprimento(50, 'troco')
      await expect(page.getByText('Suprimento registrado')).toBeVisible()
    })
    await test.step('Então o total de sangrias deve ser R$ 30,00', () => expect(caixa.linhaGaveta('Sangrias')).toContainText(reBrl(30)))
    await test.step('E o total de suprimentos deve ser R$ 50,00', () => expect(caixa.linhaGaveta('Suprimentos')).toContainText(reBrl(50)))
    await test.step('E o esperado na gaveta deve ser R$ 120,00', () => expect(caixa.esperado).toHaveText(reBrl(120)))
    await test.step('E no banco: totais da sessão e as duas movimentações com motivo', () => {
      expect(sessaoGravada()).toMatchObject({ total_sangrias: 30, total_suprimentos: 50 })
      expect(consultarBanco('select tipo, valor, motivo from movimentacoes_caixa order by id')).toEqual([
        { tipo: 'sangria', valor: 30, motivo: 'depósito' },
        { tipo: 'suprimento', valor: 50, motivo: 'troco' },
      ])
    })
  })

  test('Sangria maior que o saldo é recusada', async ({ page, pdv }) => {
    const caixa = new TelaCaixa(page)
    await test.step('Dado que o caixa foi aberto com R$ 100,00 e não tem vendas', () => pdv.abrirCaixa(100))
    await caixa.abrir()
    await test.step('Quando tento registrar uma sangria de R$ 150,00', () => caixa.sangria(150))
    await test.step('Então devo receber erro "Saldo insuficiente para sangria"', () =>
      expect(page.getByText('Saldo insuficiente para sangria')).toBeVisible())
    await test.step('E nenhuma sangria é gravada', () => expect(consultarBanco('select count(*) as n from movimentacoes_caixa')).toEqual([{ n: 0 }]))
  })

  test('Sangria não pode usar dinheiro de PIX ou cartão', async ({ page, pdv }) => {
    const caixa = new TelaCaixa(page)
    await test.step('Dado um caixa aberto com R$ 10,00 e uma venda de R$ 50,00 no PIX', async () => {
      await pdv.abrirCaixa(10)
      await pdv.adicionar('Café Expresso')
      await pdv.qtdItem('Café Expresso').fill('10')
      await pdv.pagar('PIX')
    })
    await caixa.abrir()
    await test.step('Quando tento registrar uma sangria de R$ 40,00', () => caixa.sangria(40))
    await test.step('Então devo receber erro "Saldo insuficiente para sangria"', () =>
      expect(page.getByText('Saldo insuficiente para sangria')).toBeVisible())
  })
})

/** cenarios_testes.md — 2. Caixa · Funcionalidade: Fechamento de caixa */
test.describe('Fechamento de caixa @caixa @fechamento', () => {
  test.beforeEach(async ({ seed }) => {
    await test.step('Dado o roteiro do dia D (abertura 100, V1–V3, V4 cancelada, sangria 30, suprimento 50)', async () => seed('dia-d'))
  })

  test('Tela do caixa mostra o resumo por forma e o esperado na gaveta', async ({ page }) => {
    const caixa = new TelaCaixa(page)
    await test.step('Quando abro a tela /caixa com a sessão ainda aberta', () => caixa.abrir())
    await test.step('Então devo ver Dinheiro 18,00, PIX 30,00, Cartão 22,50 e Total vendido 70,50', async () => {
      await expect(caixa.card('dinheiro')).toContainText(reBrl(18))
      await expect(caixa.card('pix')).toContainText(reBrl(30))
      await expect(caixa.card('cartao')).toContainText(reBrl(22.5))
      await expect(caixa.card('total')).toContainText(reBrl(70.5))
      await expect(page.getByText(/Cartão: crédito R\$\s*0,00 · débito R\$\s*22,50/)).toBeVisible()
    })
    await test.step('E "Esperado na gaveta" deve ser R$ 138,00', () => expect(caixa.esperado).toHaveText(reBrl(138)))
    await test.step('E deve aparecer o aviso de que o valor só bate se sangrias e suprimentos foram registrados', () =>
      expect(caixa.gaveta).toContainText('só bate se todas as sangrias'))
  })

  test('Resumo do fechamento por forma de pagamento', async ({ page }) => {
    const caixa = new TelaCaixa(page)
    await caixa.abrir()
    let resumo: any
    await test.step('Quando fecho o caixa', async () => { resumo = await caixa.fechar(138) })
    await test.step('Então o resumo deve mostrar os totais por forma, quantidade e ticket', () => {
      expect(Number(resumo.total_dinheiro)).toBe(18)
      expect(Number(resumo.total_pix)).toBe(30)
      expect(Number(resumo.total_cartao_debito)).toBe(22.5)
      expect(Number(resumo.total_cartao_credito)).toBe(0)
      expect(Number(resumo.total_vale)).toBe(0)
      expect(resumo.quantidade_vendas).toBe(3)
      expect(Number(resumo.ticket_medio)).toBe(23.5)
      expect(Number(resumo.sessao.total_vendas)).toBe(70.5)
    })
  })

  test('Diferença de caixa considera só o dinheiro físico', async ({ page }) => {
    const caixa = new TelaCaixa(page)
    await caixa.abrir()
    await test.step('Quando fecho o caixa informando R$ 138,00 contados na gaveta', () => caixa.fechar(138))
    await test.step('Então a diferença deve ser R$ 0,00', () =>
      expect(page.getByText(/Caixa fechado\. Diferença: R\$\s*0,00/)).toBeVisible())
    await test.step('E no banco a sessão fica fechada com 138,00 contados e diferença 0', () =>
      expect(sessaoGravada()).toEqual({ status: 'fechado', valor_abertura: 100, valor_fechamento: 138, total_vendas: 70.5,
        total_sangrias: 30, total_suprimentos: 50, diferenca: 0 }))
  })

  test('Fechamento com falta de dinheiro', async ({ page }) => {
    const caixa = new TelaCaixa(page)
    await caixa.abrir()
    await test.step('Quando fecho o caixa informando R$ 135,00', () => caixa.fechar(135))
    await test.step('Então a diferença deve ser negativa em R$ 3,00', () =>
      expect(page.getByText(/Caixa fechado\. Diferença: -R\$\s*3,00/)).toBeVisible())
    await test.step('E no banco a diferença gravada é −3,00', () =>
      expect(sessaoGravada()).toMatchObject({ status: 'fechado', valor_fechamento: 135, diferenca: -3 }))
  })

  test('Total do caixa fechado aparece no dashboard do dia', async ({ page }) => {
    const caixa = new TelaCaixa(page)
    await caixa.abrir()
    await test.step('Quando fecho o caixa', () => caixa.fechar(138))
    await test.step('E abro o dashboard com o filtro "Hoje"', () => page.goto('/dashboard'))
    await test.step('Então o "Fat. Líquido" deve ser R$ 70,50', () => expect(kpi(page, 'faturamento_liquido')).toHaveText(reBrl(70.5)))
    await test.step('E o "Faturamento Bruto" deve ser R$ 79,50', () => expect(kpi(page, 'faturamento_bruto')).toHaveText(reBrl(79.5)))
    await test.step('E a "Qtd. Vendas" deve ser 3', () => expect(kpi(page, 'quantidade_vendas')).toHaveText('3'))
  })

  test('Após o fechamento, a tela volta ao estado sem sessão e com valores zerados', async ({ page, pdv }) => {
    const caixa = new TelaCaixa(page)
    await caixa.abrir()
    await test.step('Quando fecho o caixa', () => caixa.fechar(138))
    await test.step('E volto para a tela /caixa', () => caixa.abrir())
    await test.step('Então devo ver que não há sessão aberta', () => expect(page.getByText('Nenhuma sessão aberta')).toBeVisible())
    await test.step('E a abertura no PDV deve começar com o valor zerado', async () => {
      await pdv.abrir()
      await expect(page.getByTestId('abertura-valor')).toHaveValue(reBrl(0))
    })
  })
})
