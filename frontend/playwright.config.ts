import { defineConfig, devices } from '@playwright/test'
import { E2E_ENV, TMP_BACKEND, UVICORN } from './e2e/support/env'

/**
 * Testes E2E do ERP Padaria — cenários do cenarios_testes.md validados pelo frontend.
 * Sobe backend (SQLite próprio, e2e_padaria.db) e frontend (Vite) automaticamente.
 * Os testes rodam em série: todos compartilham o mesmo banco, resetado pelo seed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/support/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    storageState: 'e2e/.auth/admin.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      // TZ=UTC de propósito: o horário gravado tem que ser o de São Paulo mesmo com servidor em UTC.
      // cwd fora do backend/: não lê o .env de desenvolvimento (código via PYTHONPATH).
      command: `${UVICORN} app.main:app --port 8001`,
      cwd: TMP_BACKEND,
      env: { ...E2E_ENV, TZ: 'UTC' },
      url: 'http://localhost:8001/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Porta própria (5174) e proxy para o backend de teste: nunca reaproveita o
      // Vite de desenvolvimento, que apontaria para o banco de dev.
      command: 'npx vite --port 5174 --strictPort',
      env: { VITE_API_PROXY: 'http://localhost:8001' },
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
