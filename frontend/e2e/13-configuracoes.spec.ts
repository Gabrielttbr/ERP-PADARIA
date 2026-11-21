import { readFileSync } from 'fs'
import { test, expect } from './support'

const versao = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version

test.describe('Configurações @configuracoes', () => {
  test('Mostra a versão do sistema que está no package.json', async ({ page, seed }) => {
    seed('base')
    await page.goto('/configuracoes')
    await expect(page.getByTestId('versao-sistema')).toHaveText(`GiroNegócios · Versão ${versao}`)
  })
})
