import type { APIRequestContext } from '@playwright/test'
import { ADMIN, API_URL } from './env'

/** Cliente da API autenticado como admin — só para ações que não têm tela. */
export class Api {
  private token = ''
  constructor(private request: APIRequestContext) {}

  private async headers() {
    if (!this.token) {
      const r = await this.request.post(`${API_URL}/auth/login`, { data: ADMIN })
      if (!r.ok()) throw new Error(`login falhou: ${r.status()}`)
      this.token = (await r.json()).access_token
    }
    return { Authorization: `Bearer ${this.token}` }
  }

  async get(path: string) {
    const r = await this.request.get(`${API_URL}${path}`, { headers: await this.headers() })
    if (!r.ok()) throw new Error(`GET ${path}: ${r.status()} ${await r.text()}`)
    return r.json()
  }

  async post(path: string, data: unknown) {
    const r = await this.request.post(`${API_URL}${path}`, { headers: await this.headers(), data })
    return { status: r.status(), body: await r.json().catch(() => null) }
  }

  sessaoAtiva() { return this.get('/caixa/sessao-ativa') }
  produtos() { return this.get('/produtos?apenas_ativos=true') }

  async produto(nome: string) {
    const lista = await this.produtos()
    const p = lista.find((x: any) => x.nome === nome)
    if (!p) throw new Error(`produto não encontrado: ${nome}`)
    return p
  }

  /** Cancelamento de venda não tem tela no sistema. */
  cancelarVenda(vendaId: number, motivo = 'teste e2e') {
    return this.post(`/vendas/${vendaId}/cancelar`, { motivo })
  }

  /** Desconto em % não tem tela no PDV (só em R$). */
  async venderComDescontoPct(itens: { nome: string; qtd: number }[], pct: number, pagamento: { forma: string; valor: number }) {
    const sessao = await this.sessaoAtiva()
    const produtos = await this.produtos()
    return this.post('/vendas', {
      sessao_id: sessao.id,
      itens: itens.map(i => ({ produto_id: produtos.find((p: any) => p.nome === i.nome).id, quantidade: i.qtd })),
      pagamentos: [pagamento],
      desconto_pct: pct,
    })
  }
}
