import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PYTHON, TMP_BACKEND } from './env'

export const ARQUIVO_BANCO = path.join(TMP_BACKEND, 'e2e_padaria.db')

type Linha = Record<string, string | number | null>

const SCRIPT = `
import json, sqlite3, sys
con = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)  # somente leitura
con.row_factory = sqlite3.Row
linhas = con.execute(sys.argv[2], json.loads(sys.argv[3])).fetchall()
print(json.dumps([dict(l) for l in linhas], default=str))
`

/**
 * Consulta o banco do backend de teste (SQLite, SOMENTE LEITURA) para conferir o que foi
 * gravado — não só o que a tela mostra. Ex.: o P2 exibia o troco certo e gravava o pagamento errado.
 *
 *   const [venda] = consultarBanco('select total, troco from vendas where id = ?', [id])
 */
export function consultarBanco(sql: string, parametros: (string | number)[] = []): Linha[] {
  const saida = execFileSync(PYTHON, ['-c', SCRIPT, ARQUIVO_BANCO, sql, JSON.stringify(parametros)])
  return JSON.parse(saida.toString())
}

/** Venda gravada + itens + pagamentos, num formato fácil de comparar. */
export function vendaGravada(id: number) {
  const [venda] = consultarBanco(
    'select id, status, subtotal, desconto_valor, total, troco from vendas where id = ?', [id])
  const itens = consultarBanco(
    `select p.nome as produto, i.quantidade, i.preco_unit, i.custo_unit, i.total_item
       from itens_venda i join produtos p on p.id = i.produto_id where i.venda_id = ? order by i.id`, [id])
  const pagamentos = consultarBanco(
    'select forma, valor, nsu from pagamentos where venda_id = ? order by id', [id])
  return { venda, itens, pagamentos }
}

/** Última venda gravada (maior id). */
export function ultimaVendaId(): number {
  const [l] = consultarBanco('select max(id) as id from vendas')
  return Number(l.id)
}

/** Sessão de caixa (a mais recente). */
export function sessaoGravada() {
  const [s] = consultarBanco(
    `select status, valor_abertura, valor_fechamento, total_vendas, total_sangrias,
            total_suprimentos, diferenca from sessoes_caixa order by id desc limit 1`)
  return s
}

/** Estoque atual de um produto e suas movimentações (mais antiga primeiro). */
export function estoqueGravado(nome: string) {
  const [p] = consultarBanco('select id, estoque_atual from produtos where nome = ?', [nome])
  const movimentacoes = consultarBanco(
    `select tipo, quantidade, saldo_antes, saldo_depois, referencia_id
       from movimentacoes_estoque where produto_id = ? order by id`, [Number(p.id)])
  return { estoque: Number(p.estoque_atual), movimentacoes }
}
