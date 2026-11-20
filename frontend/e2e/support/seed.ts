import { execFileSync } from 'node:child_process'
import { BACKEND_DIR, E2E_ENV } from './env'

export type PerfilSeed = 'base' | 'dia-d' | 'noite'

/**
 * Reseta o banco de teste para um estado conhecido (backend/tests/e2e_seed.py).
 * base  → massa de dados da seção 0 do cenarios_testes.md
 * dia-d → base + V1–V4 (V4 cancelada), sangria 30, suprimento 50, caixa aberto com 100
 * noite → base + venda de R$ 10,00 ontem às 22:30
 */
export function seed(perfil: PerfilSeed = 'base'): void {
  execFileSync('venv/bin/python', ['-m', 'tests.e2e_seed', perfil], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...E2E_ENV },
    stdio: 'pipe',
  })
}
