import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { BACKEND_DIR } from './env'

/** Decodifica ASCII85 (filtro /ASCII85Decode, padrão do ReportLab). */
function ascii85(texto: string): Buffer {
  const dados = texto.replace(/\s/g, '').replace(/^<~/, '').replace(/~>$/, '')
  const bytes: number[] = []
  let grupo: number[] = []
  const emitir = (g: number[], n: number) => {
    let v = 0
    for (const c of g) v = v * 85 + c
    const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]
    bytes.push(...b.slice(0, n))
  }
  for (const ch of dados) {
    if (ch === 'z' && grupo.length === 0) { bytes.push(0, 0, 0, 0); continue }
    grupo.push(ch.charCodeAt(0) - 33)
    if (grupo.length === 5) { emitir(grupo, 4); grupo = [] }
  }
  if (grupo.length) {
    const n = grupo.length - 1
    while (grupo.length < 5) grupo.push(84)
    emitir(grupo, n)
  }
  return Buffer.from(bytes)
}

/** Texto de um PDF do ReportLab: decodifica os streams (ASCII85 + Flate) e junta as strings dos operadores Tj. */
export function textoPdf(caminho: string): string {
  const bin = readFileSync(caminho).toString('latin1')
  const partes: string[] = []
  const re = /stream\r?\n([\s\S]*?)\s*endstream/g
  for (let m; (m = re.exec(bin)); ) {
    let conteudo = m[1]
    const bruto = conteudo.trimEnd().endsWith('~>') ? ascii85(conteudo) : Buffer.from(conteudo, 'latin1')
    try { conteudo = inflateSync(bruto).toString('latin1') } catch { conteudo = bruto.toString('latin1') }
    for (const t of conteudo.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) partes.push(t[1].replace(/\\(.)/g, '$1'))
  }
  return partes.join(' ')
}

/** Linhas da primeira aba de um .xlsx (lidas com o openpyxl do venv do backend). */
export function linhasExcel(caminho: string): (string | number | null)[][] {
  // Abre como arquivo binário: o openpyxl recusa caminhos sem extensão .xlsx (caso do download do Playwright).
  const script = 'import io,json,sys,openpyxl;ws=openpyxl.load_workbook(io.BytesIO(open(sys.argv[1],"rb").read())).active;print(json.dumps([list(r) for r in ws.iter_rows(values_only=True)],default=str))'
  const saida = execFileSync('venv/bin/python', ['-c', script, caminho], { cwd: BACKEND_DIR }).toString()
  return JSON.parse(saida)
}
