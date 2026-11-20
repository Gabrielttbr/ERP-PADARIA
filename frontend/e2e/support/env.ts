import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))

export const BACKEND_DIR = path.resolve(aqui, '../../../backend')
export const API_URL = 'http://localhost:8001/api'

/** Variáveis do backend em teste — banco SQLite próprio, impressora em arquivo. */
export const E2E_ENV: Record<string, string> = {
  DATABASE_URL_OVERRIDE: 'sqlite+aiosqlite:///./e2e_padaria.db',
  PRINTER_TYPE: 'file',
  APP_DEBUG: 'false',
  APP_ENV: 'development',
  JWT_SECRET_KEY: 'e2e-secret-key-com-pelo-menos-32-caracteres!!',
  CORS_ORIGINS: 'http://localhost:5174',
  REPORT_TIMEZONE: 'America/Sao_Paulo',
}

export const ADMIN = { email: 'admin@padaria.com', senha: 'Admin@1234' }
