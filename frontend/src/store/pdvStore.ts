import { create } from 'zustand'

export interface CartItem {
  produto_id: number
  nome: string
  preco_unit: number
  custo_unit: number
  quantidade: number
  desconto_unit: number
  unidade_medida: string
  total_item: number
}

interface PDVState {
  sessaoId: number | null
  cart: CartItem[]
  desconto: number           // valor absoluto em R$
  descontoPct: number
  observacao: string
  clienteId: number | null
  clienteNome: string | null

  setSessaoId: (id: number | null) => void
  addItem: (item: Omit<CartItem, 'total_item'>) => void
  addDiversoItem: (preco: number, quantidade: number) => void
  updateQuantidade: (produto_id: number, quantidade: number) => void
  removeItem: (produto_id: number) => void
  clearCart: () => void
  setDesconto: (valor: number, pct?: number) => void
  setObservacao: (obs: string) => void
  setCliente: (id: number | null, nome: string | null) => void

  // Computed
  subtotal: () => number
  total: () => number
}

export const usePDVStore = create<PDVState>((set, get) => ({
  sessaoId: null,
  cart: [],
  desconto: 0,
  descontoPct: 0,
  observacao: '',
  clienteId: null,
  clienteNome: null,

  setSessaoId: (id) => set({ sessaoId: id }),

  addItem: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.produto_id === item.produto_id)
      if (existing) {
        // Incrementa quantidade se já existe
        return {
          cart: state.cart.map((c) =>
            c.produto_id === item.produto_id
              ? {
                  ...c,
                  quantidade: c.quantidade + item.quantidade,
                  total_item: (c.quantidade + item.quantidade) * (c.preco_unit - c.desconto_unit),
                }
              : c
          ),
        }
      }
      const total_item = item.quantidade * (item.preco_unit - item.desconto_unit)
      return { cart: [...state.cart, { ...item, total_item }] }
    }),

  addDiversoItem: (preco, quantidade) =>
    set((state) => {
      // Usa ID temporário único (900000+) para não agrupar itens diversos diferentes
      // O ID real (17) será enviado ao backend com preco_unit customizado
      const timestamp = Date.now()
      const uniqueId = 900000 + (timestamp % 100000)

      const item: CartItem = {
        produto_id: uniqueId,
        nome: 'DIVERSO',
        preco_unit: preco,
        custo_unit: 0,
        quantidade,
        desconto_unit: 0,
        unidade_medida: 'un',
        total_item: preco * quantidade,
      }
      return { cart: [...state.cart, item] }
    }),

  updateQuantidade: (produto_id, quantidade) =>
    set((state) => {
      if (quantidade <= 0) {
        return { cart: state.cart.filter((c) => c.produto_id !== produto_id) }
      }
      return {
        cart: state.cart.map((c) =>
          c.produto_id === produto_id
            ? { ...c, quantidade, total_item: quantidade * (c.preco_unit - c.desconto_unit) }
            : c
        ),
      }
    }),

  removeItem: (produto_id) =>
    set((state) => ({ cart: state.cart.filter((c) => c.produto_id !== produto_id) })),

  clearCart: () => set({ cart: [], desconto: 0, descontoPct: 0, observacao: '', clienteId: null, clienteNome: null }),

  setDesconto: (valor, pct = 0) => set({ desconto: valor, descontoPct: pct }),

  setObservacao: (obs) => set({ observacao: obs }),

  setCliente: (id, nome) => set({ clienteId: id, clienteNome: nome }),

  subtotal: () => get().cart.reduce((acc, item) => acc + item.total_item, 0),

  total: () => {
    const sub = get().subtotal()
    const desc = get().descontoPct > 0
      ? sub * get().descontoPct / 100
      : get().desconto
    return Math.max(0, sub - desc)
  },
}))
