import { test as base, expect } from '@playwright/test'
import { Api } from './api'
import { Pdv } from './pdv'
import { seed, type PerfilSeed } from './seed'

type Fixtures = {
  api: Api
  pdv: Pdv
  seed: (perfil?: PerfilSeed) => void
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => { await use(new Api(request)) },
  pdv: async ({ page }, use) => { await use(new Pdv(page)) },
  // eslint-disable-next-line no-empty-pattern
  seed: async ({}, use) => { await use(seed) },
})

export { expect }
export { brl, reBrl, digitarValor } from './dinheiro'
