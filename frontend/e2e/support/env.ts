import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))

export const BACKEND_DIR = path.resolve(aqui, '../../../backend')
export const API_URL = 'http://localhost:8001/api'

/**
 * Pasta de trabalho do backend de teste (cwd): fica FORA do backend/ para não ler o .env de
 * desenvolvimento. Guarda o e2e_padaria.db, os uploads e o recibo (PRINTER_TYPE=file grava em
 * <TMPDIR>/ultimo_recibo.bin).
 */
export const TMP_BACKEND = path.join(tmpdir(), 'erp-padaria-e2e')
mkdirSync(TMP_BACKEND, { recursive: true })
export const ARQUIVO_RECIBO = path.join(TMP_BACKEND, 'ultimo_recibo.bin')

/** Variáveis do backend em teste — banco SQLite próprio, impressora em arquivo. */
export const E2E_ENV: Record<string, string> = {
  DATABASE_URL_OVERRIDE: 'sqlite+aiosqlite:///./e2e_padaria.db',
  PRINTER_TYPE: 'file',
  APP_DEBUG: 'false',
  APP_ENV: 'development',
  JWT_SECRET_KEY: 'e2e-secret-key-com-pelo-menos-32-caracteres!!',
  CORS_ORIGINS: 'http://localhost:5174',
  REPORT_TIMEZONE: 'America/Sao_Paulo',
  TMPDIR: TMP_BACKEND,
  PYTHONPATH: BACKEND_DIR,
}

export const PYTHON = path.join(BACKEND_DIR, 'venv/bin/python')
export const UVICORN = path.join(BACKEND_DIR, 'venv/bin/uvicorn')

export const ADMIN = { email: 'admin@padaria.com', senha: 'Admin@1234' }
