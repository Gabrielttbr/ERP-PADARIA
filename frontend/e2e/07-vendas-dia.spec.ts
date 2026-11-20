import { test, expect, reBrl, Dashboard, diaSP, ddMM, textoPdf, linhasExcel } from './support'

/** cenarios_testes.md — 5. Funcionalidade: Vendas por dia (gráfico do dashboard + PDF/Excel) */
test.describe('Vendas por dia @relatorio @vendas-dia', () => {
  test('Um dia com vendas', async ({ page, seed }) => {
    const dash = new Dashboard(page)
    await test.step('Dado que foi executado o roteiro do dia D', async () => seed('dia-d'))
    let dados: any
    await test.step('Quando consulto "Vendas por dia" do período D até D', async () => { dados = await dash.abrir('Hoje') })
    await test.step('Então deve existir 1 linha com D, R$ 70,50 e 3 vendas', async () => {
      expect(dados.vendas_por_dia).toEqual([{ data: diaSP(), total_vendas: '70.50', quantidade_vendas: 3 }])
      await expect(page.locator('.recharts-area')).toBeVisible()
    })
  })

  test('Vários dias, cada um no seu dia', async ({ page, seed }) => {
    const dash = new Dashboard(page)
    await test.step('Dado vendas de R$ 10,00 no dia D-1 (22:30) e R$ 70,50 no dia D', async () => seed('dia-d-e-ontem'))
    let dados: any
    await test.step('Quando consulto o período "7 dias"', async () => {
      const resposta = page.waitForResponse(r => r.url().includes('/api/dashboard?'))
      await page.goto('/dashboard')
      dados = await (await resposta).json()
    })
    await test.step('Então o dia D-1 deve mostrar R$ 10,00 e o dia D R$ 70,50', async () => {
      expect(dados.vendas_por_dia).toEqual([
        { data: diaSP(-1), total_vendas: '10.00', quantidade_vendas: 1 },
        { data: diaSP(), total_vendas: '70.50', quantidade_vendas: 3 },
      ])
      await expect(page.locator('.recharts-xAxis').getByText(ddMM(diaSP(-1)))).toBeVisible()
      await expect(page.locator('.recharts-xAxis').getByText(ddMM(diaSP()))).toBeVisible()
    })
    await test.step('E a soma das barras deve ser igual ao "Fat. Líquido" do período', () =>
      expect(dash.kpi('faturamento_liquido')).toHaveText(reBrl(80.5)))
  })

  test('Venda das 22h fica no dia certo do gráfico', async ({ page, seed }) => {
    const dash = new Dashboard(page)
    await test.step('Dado uma venda de R$ 10,00 no dia D-1 às 22:30 (Brasília)', async () => seed('noite'))
    await dash.abrir('Hoje')
    let dados: any
    await test.step('Quando consulto "Vendas por dia" de D-1 até D', async () => { dados = await dash.periodo(diaSP(-1), diaSP()) })
    await test.step('Então a venda deve aparecer no dia D-1, e não em D', () =>
      expect(dados.vendas_por_dia).toEqual([{ data: diaSP(-1), total_vendas: '10.00', quantidade_vendas: 1 }]))
  })
})

test.describe('Relatório de vendas em PDF/Excel @relatorio @vendas-dia', () => {
  async function abrirRelatorio(page: import('@playwright/test').Page, de: string, ate: string) {
    await page.goto('/relatorios')
    const datas = page.locator('input[type="date"]')
    await datas.nth(0).fill(de)
    await datas.nth(1).fill(ate)
  }

  async function baixar(page: import('@playwright/test').Page, botao: string) {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: botao }).click()
    return (await download).path()
  }

  test('Relatório PDF/Excel bate com o dashboard', async ({ page, seed }) => {
    await test.step('Dado que foi executado o roteiro do dia D', async () => seed('dia-d'))
    await abrirRelatorio(page, diaSP(), diaSP())
    await test.step('Quando exporto o relatório de vendas de D em PDF', async () => {
      const pdf = textoPdf(await baixar(page, 'Exportar PDF'))
      await test.step('Então deve listar 3 vendas e TOTAL GERAL R$ 70,50', () => {
        expect(pdf).toContain('Total de vendas: 3')
        expect(pdf).toContain('TOTAL GERAL')
        expect(pdf).toContain('R$ 70.50')
      })
    })
    await test.step('Quando exporto o relatório de vendas de D em Excel', async () => {
      const linhas = linhasExcel(await baixar(page, 'Exportar Excel'))
      const vendas = linhas.slice(1).filter(l => typeof l[0] === 'number')
      await test.step('Então deve listar 3 vendas e TOTAL GERAL R$ 70,50', () => {
        expect(vendas.map(v => v[0])).toEqual([1, 2, 3])
        const total = linhas.find(l => l.includes('TOTAL GERAL'))!
        expect(total[6]).toBe(70.5)
      })
      await test.step('E a venda cancelada V4 não deve aparecer', () => expect(vendas.some(v => v[0] === 4)).toBe(false))
    })
  })

  test('Relatório PDF/Excel inclui venda das 22h', async ({ page, seed }) => {
    await test.step('Dado uma venda de R$ 10,00 no dia D-1 às 22:30 (Brasília)', async () => seed('noite'))
    await abrirRelatorio(page, diaSP(-1), diaSP(-1))
    await test.step('Quando exporto o relatório de vendas de D-1', async () => {
      const linhas = linhasExcel(await baixar(page, 'Exportar Excel'))
      const vendas = linhas.slice(1).filter(l => typeof l[0] === 'number')
      await test.step('Então a venda deve aparecer no relatório de D-1', () => expect(vendas).toHaveLength(1))
      await test.step('E o horário mostrado deve ser 22:30', () => {
        const [a, m, d] = diaSP(-1).split('-')
        expect(vendas[0][1]).toBe(`${d}/${m}/${a} 22:30`)
      })
    })
  })
})
