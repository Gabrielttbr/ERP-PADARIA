import { existsSync, readFileSync, rmSync } from 'node:fs'
import { test, expect, diaSP, horaSP } from './support'
import { ARQUIVO_RECIBO } from './support/env'

/**
 * cenarios_testes.md — 9.1 Funcionalidade: Horário do sistema em São Paulo.
 * O backend de teste roda com TZ=UTC (playwright.config.ts): tudo tem que sair no horário de SP.
 */

/** Aceita a hora atual de SP com 1 minuto de folga (virada de minuto durante o teste). */
function horasAceitas(): RegExp {
  return new RegExp(`(${horaSP(-1)}|${horaSP()}|${horaSP(1)})`)
}

test.describe('Horário do sistema em São Paulo @horario', () => {
  test.beforeEach(async ({ seed }) => seed('base'))

  test('Recibo sai com a hora local', async ({ pdv }) => {
    rmSync(ARQUIVO_RECIBO, { force: true })
    await test.step('Quando finalizo uma venda e o recibo é impresso', async () => {
      await pdv.abrirCaixa(100)
      await pdv.adicionar('Café Expresso')
      await pdv.pagar('Dinheiro')
    })
    await test.step('Então o recibo deve mostrar a data e a hora de São Paulo (e não UTC)', async () => {
      await expect.poll(() => existsSync(ARQUIVO_RECIBO)).toBe(true)
      const recibo = readFileSync(ARQUIVO_RECIBO).toString('latin1')
      const [a, m, d] = diaSP().split('-')
      const linha = recibo.match(/Venda: #\d+\s+(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})/)
      expect(linha, 'linha "Venda: #... dd/mm/aaaa HH:MM" no recibo').not.toBeNull()
      expect(linha![1]).toBe(`${d}/${m}/${a}`)
      expect(linha![2]).toMatch(horasAceitas())
    })
  })

  test('Telas mostram a hora local', async ({ page, pdv }) => {
    await test.step('Dado que abro o caixa agora', () => pdv.abrirCaixa(100))
    await test.step('Então o PDV deve mostrar "Aberto às" com a hora de São Paulo', () =>
      expect(page.getByText(/Aberto às \d{2}:\d{2}/)).toContainText(horasAceitas()))
    await test.step('E a tela do caixa deve mostrar "desde" com a hora de São Paulo', async () => {
      await page.goto('/caixa')
      await expect(page.getByText(/desde \d{2}:\d{2}/)).toContainText(horasAceitas())
    })
    await test.step('E a auditoria deve registrar a abertura com a hora de São Paulo', async () => {
      await page.goto('/auditoria')
      await expect(page.getByText(new RegExp(`^${horaSP()}:\\d{2}$|^${horaSP(-1)}:\\d{2}$`)).first()).toBeVisible()
    })
  })

  test('Servidor em UTC não muda o horário gravado', async ({ page, pdv, api }) => {
    let vendaId = 0
    await test.step('Dado que o backend está com fuso UTC (TZ=UTC)', async () => {})
    await test.step('Quando finalizo uma venda agora', async () => {
      await pdv.abrirCaixa(100)
      await pdv.adicionar('Café Expresso')
      const resposta = page.waitForResponse(r => r.url().endsWith('/api/vendas') && r.request().method() === 'POST')
      await pdv.pagar('Dinheiro')
      vendaId = (await (await resposta).json()).id
    })
    await test.step('Então a venda deve ser gravada com a data e a hora de São Paulo', async () => {
      const venda = await api.get(`/vendas/${vendaId}`)
      expect(venda.created_at.slice(0, 10)).toBe(diaSP())
      expect(venda.created_at.slice(11, 16)).toMatch(horasAceitas())
    })
  })

  test('Arquivo exportado do estoque usa a data local', async ({ page }) => {
    await page.goto('/estoque')
    await test.step('Quando exporto os produtos para Excel', async () => {
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Exportar Excel' }).click()
      await test.step('Então o arquivo deve se chamar "produtos_<hoje em SP>.xlsx"', async () =>
        expect((await download).suggestedFilename()).toBe(`produtos_${diaSP()}.xlsx`))
    })
  })
})
