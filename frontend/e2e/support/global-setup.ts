import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { ADMIN } from './env'
import { seed } from './seed'

/** Seed base + login do admin pela tela, salvo em e2e/.auth/admin.json. */
export default async function globalSetup(config: FullConfig) {
  seed('base')
  const { baseURL } = config.projects[0].use
  mkdirSync('e2e/.auth', { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await page.goto('/login')
  await page.getByPlaceholder('usuario@padaria.com').fill(ADMIN.email)
  await page.getByPlaceholder('••••••••').fill(ADMIN.senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL('**/dashboard')
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
  await browser.close()
}
