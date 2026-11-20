import { execFileSync } from 'node:child_process'
import { E2E_ENV, PYTHON, TMP_BACKEND } from './env'

export type PerfilSeed = 'base' | 'dia-d' | 'noite' | 'dia-d-e-ontem'

/**
 * Reseta o banco de teste para um estado conhecido (backend/tests/e2e_seed.py).
 * base  → massa de dados da seção 0 do cenarios_testes.md
 * dia-d → base + V1–V4 (V4 cancelada), sangria 30, suprimento 50, caixa aberto com 100
 * noite → base + venda de R$ 10,00 ontem às 22:30
 */
export function seed(perfil: PerfilSeed = 'base'): void {
  execFileSync(PYTHON, ['-m', 'tests.e2e_seed', perfil], {
    cwd: TMP_BACKEND,
    env: { ...process.env, ...E2E_ENV },
    stdio: 'pipe',
  })
}
