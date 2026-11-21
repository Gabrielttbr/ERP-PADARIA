import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { api } from '@/config/api'
import { formatBRL } from '@/utils/currency'
import { useCurrencyInput } from '@/hooks/useCurrencyInput'
import ImportarExcelModal from './ImportarExcelModal'
import { mensagemErro } from '@/utils/erro'

interface Produto {
  id: number
  codigo_barras?: string
  nome: string
  fabricante?: string
  categoria_id: number
  categoria_nome?: string
  preco_custo: number
  preco_venda: number
  margem_lucro: number
  estoque_atual: number
  estoque_minimo: number
  unidade_medida: string
  estoque_baixo: boolean
  ativo: boolean
}

interface Categoria {
  id: number
  nome: string
  descricao?: string | null
  ativo?: boolean
  parent_id?: number | null
}

interface CategoriaNode extends Categoria {
  filhos: CategoriaNode[]
  nivel: number
  caminho: string
}

function buildTree(flat: Categoria[]): CategoriaNode[] {
  const byId = new Map<number, CategoriaNode>()
  flat.forEach(c => byId.set(c.id, { ...c, filhos: [], nivel: 0, caminho: c.nome }))

  // 1ª passagem: monta links pai-filho sem calcular nível
  const roots: CategoriaNode[] = []
  byId.forEach(node => {
    const pid = node.parent_id
    if (pid && byId.has(pid)) {
      byId.get(pid)!.filhos.push(node)
    } else {
      roots.push(node)
    }
  })

  // 2ª passagem: BFS a partir das raízes garante nível e caminho corretos
  // independente da ordem de chegada da API
  const fila: { node: CategoriaNode; nivel: number; caminho: string }[] =
    roots.map(r => ({ node: r, nivel: 0, caminho: r.nome }))
  while (fila.length) {
    const { node, nivel, caminho } = fila.shift()!
    node.nivel  = nivel
    node.caminho = caminho
    node.filhos.forEach(filho =>
      fila.push({ node: filho, nivel: nivel + 1, caminho: `${caminho} › ${filho.nome}` })
    )
  }

  const sortRec = (arr: CategoriaNode[]) => {
    arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    arr.forEach(n => sortRec(n.filhos))
  }
  sortRec(roots)
  return roots
}

function flattenTree(roots: CategoriaNode[]): CategoriaNode[] {
  const out: CategoriaNode[] = []
  const walk = (n: CategoriaNode) => { out.push(n); n.filhos.forEach(walk) }
  roots.forEach(walk)
  return out
}

const UNIDADES = ['un', 'kg']

// Normalizes BR decimal input ("5,0" → 5, "5.000" → 5, "2,5" → 2.5)
const parseQtd = (v: string) => parseFloat(v.replace(',', '.').replace(/\.(?=.*\.)/g, '')) || 0

type StatusNivel = 'desastre' | 'critico' | 'atencao' | 'bom' | 'excelente'

function calcStatus(atual: number | string, minimo: number | string): StatusNivel {
  const a = parseFloat(String(atual))
  const m = parseFloat(String(minimo))
  if (a <= 0)       return 'desastre'
  if (m <= 0)       return 'bom'
  if (a <= m * 0.3) return 'critico'
  if (a <= m)       return 'atencao'
  if (a <= m * 2)   return 'bom'
  return 'excelente'
}

const STATUS_STYLE: Record<StatusNivel, { label: string; bg: string; color: string; border: string }> = {
  desastre:  { label: 'Desastre',  bg: '#FEF2F2', color: '#7F1D1D', border: '#FECACA' },
  critico:   { label: 'Crítico',   bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5' },
  atencao:   { label: 'Atenção',   bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
  bom:       { label: 'Bom',       bg: 'var(--clr-green-lite)', color: 'var(--clr-green)', border: 'var(--clr-border-2)' },
  excelente: { label: 'Excelente', bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
}

function StatusBadge({ atual, minimo }: { atual: number | string; minimo: number | string }) {
  const nivel = calcStatus(atual, minimo)
  const s = STATUS_STYLE[nivel]
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  )
}

// Padrões do cadastro novo: estoque "infinito" (maior inteiro que cabe na coluna
// Numeric(10,3) = 9.999.999,999) e custo simbólico de R$ 0,01.
const ESTOQUE_INICIAL_PADRAO = '9999999'
const CUSTO_PADRAO = 0.01

const emptyForm = {
  nome: '',
  codigo_barras: '',
  fabricante: '',
  categoria_id: '',
  preco_venda: '',
  preco_custo: '',
  unidade_medida: 'un',
  estoque_atual: ESTOQUE_INICIAL_PADRAO,
  estoque_minimo: '0',
  descricao: '',
}

function StockBar({ atual: _atual, minimo: _minimo }: { atual: number | string; minimo: number | string }) {
  const atual  = parseFloat(String(_atual))
  const minimo = parseFloat(String(_minimo))
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const max = Math.max(minimo * 4, atual * 1.2, 1)
    const pct = Math.min((atual / max) * 100, 100)
    const t = setTimeout(() => setWidth(pct), 120)
    return () => clearTimeout(t)
  }, [atual, minimo])

  const nivel = calcStatus(atual, minimo)
  const cor = nivel === 'desastre' ? 'var(--clr-danger)'
            : nivel === 'critico'  ? '#DC2626'
            : nivel === 'atencao'  ? '#F59E0B'
            : nivel === 'excelente'? '#059669'
            : 'var(--clr-green-med)'

  return (
    <div className="w-full h-1 rounded-full mt-1" style={{ background: 'var(--clr-bg)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          background: cor,
          transition: 'width 0.65s cubic-bezier(0.22,0.61,0.36,1)',
        }}
      />
    </div>
  )
}

const IconClose = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18L18 6M6 6l12 12"/>
  </svg>
)

const IconWarning = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--clr-warning)' }}>
    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
  </svg>
)

const IconBarcode = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
  </svg>
)

export default function EstoquePage() {
  const [busca, setBusca]           = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | null>(null)
  const [ajuste, setAjuste]         = useState<any>(null)
  const [showForm, setShowForm]     = useState(false)
  const [editando, setEditando]     = useState<Produto | null>(null)
  const [form, setForm]             = useState({ ...emptyForm })
  const precoVenda = useCurrencyInput()
  const precoCusto = useCurrencyInput()
  const [confirmDel, setConfirmDel] = useState<Produto | null>(null)
  const [showCategorias, setShowCategorias] = useState(false)
  const [novaCategoria, setNovaCategoria]   = useState('')
  const [novoParentId, setNovoParentId]     = useState<string>('')
  const [confirmDelCat, setConfirmDelCat]   = useState<Categoria | null>(null)
  const [movendoCat, setMovendoCat]         = useState<number | null>(null)
  const [editandoCat, setEditandoCat]       = useState<number | null>(null)
  const [editNomeCat, setEditNomeCat]       = useState('')
  const [showImportarExcel, setShowImportarExcel] = useState(false)
  const [exportando, setExportando]         = useState(false)
  // Cadastro contínuo: depois de cadastrar, o formulário fica aberto e limpo
  // (mantendo categoria e unidade) pra ler o próximo produto na sequência.
  const [continuo, setContinuo] = useState(() => {
    try { return localStorage.getItem('estoque.cadastroContinuo') !== '0' } catch { return true }
  })
  const [cadastradosSessao, setCadastradosSessao] = useState(0)
  const formRef = useRef<HTMLDivElement>(null)

  async function exportarExcel() {
    setExportando(true)
    try {
      const response = await api.get('/produtos/excel/exportar', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url
      link.download = `produtos_${new Date().toLocaleDateString('sv-SE')}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro ao gerar o Excel')
    } finally {
      setExportando(false)
    }
  }
  const barcodeInputRef             = useRef<HTMLInputElement>(null)

  // F2 abre o cadastro de produto (quando nenhum modal está aberto)
  const abrirNovoRef = useRef<() => void>(() => {})
  abrirNovoRef.current = () => { if (!showForm && !ajuste && !showCategorias && !showImportarExcel) abrirNovo() }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); abrirNovoRef.current() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const queryClient                 = useQueryClient()

  const { data: produtos, isLoading } = useQuery(
    ['produtos', busca],
    () => api.get(`/produtos?q=${busca}&apenas_ativos=true`).then(r => r.data),
    { staleTime: 10_000 }
  )

  const { data: categorias } = useQuery<Categoria[]>(
    'categorias',
    () => api.get('/categorias').then(r => r.data),
    { staleTime: 60_000 }
  )

  const produtosFiltrados = useMemo(() => {
    if (!categoriaFiltro) return produtos || []
    return (produtos || []).filter((p: Produto) => p.categoria_id === categoriaFiltro)
  }, [produtos, categoriaFiltro])

  const catTree = useMemo(() => flattenTree(buildTree(categorias || [])), [categorias])

  const criarCategoriaM = useMutation(
    (payload: { nome: string; parent_id: number | null }) =>
      api.post('/categorias', payload).then(r => r.data),
    {
      onSuccess: () => {
        toast.success('Categoria criada!')
        queryClient.invalidateQueries('categorias')
        setNovaCategoria('')
        // mantém novoParentId pra criar várias subcategorias do mesmo pai em lote
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro ao criar categoria')) },
    }
  )

  const renomearCategoriaM = useMutation(
    ({ id, nome }: { id: number; nome: string }) =>
      api.patch(`/categorias/${id}`, { nome }).then(r => r.data),
    {
      onSuccess: () => {
        toast.success('Nome atualizado')
        queryClient.invalidateQueries('categorias')
        setEditandoCat(null)
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro ao renomear')) },
    }
  )

  const moverCategoriaM = useMutation(
    ({ id, parent_id }: { id: number; parent_id: number | null }) =>
      api.patch(`/categorias/${id}`, { parent_id }).then(r => r.data),
    {
      onSuccess: () => {
        toast.success('Hierarquia atualizada')
        queryClient.invalidateQueries('categorias')
        setMovendoCat(null)
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro ao mover')) },
    }
  )

  const deletarCategoriaM = useMutation(
    (id: number) => api.delete(`/categorias/${id}`),
    {
      onSuccess: () => {
        toast.success('Categoria removida')
        queryClient.invalidateQueries('categorias')
        queryClient.invalidateQueries('produtos')
        setConfirmDelCat(null)
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro ao remover categoria')) },
    }
  )

  const criarM = useMutation(
    (payload: any) => api.post('/produtos', payload).then(r => r.data),
    {
      onSuccess: (p: Produto) => {
        toast.success('Produto cadastrado!')
        queryClient.invalidateQueries('produtos')
        if (continuo) {
          setCadastradosSessao(n => n + 1)
          proximoCadastro(p?.nome)
        } else {
          fecharForm()
        }
      },
      onError: (e: any) => {
        toast.error(mensagemErro(e, 'Erro ao cadastrar'))
        // código de barras repetido é o erro mais comum: volta pra ele
        if (e?.response?.status === 409) focarCampo('codigo_barras')
      },
    }
  )

  const editarM = useMutation(
    async ({ id, payload, estoqueAtualNovo, estoqueAtualOriginal }: any) => {
      const res = await api.put(`/produtos/${id}`, payload).then(r => r.data)
      const novo = Number(estoqueAtualNovo)
      const orig = Number(estoqueAtualOriginal)
      if (!Number.isNaN(novo) && novo !== orig) {
        await api.post('/estoque/ajuste', {
          produto_id: id,
          tipo: 'ajuste',
          quantidade: novo,
          observacao: 'Ajuste via edição de cadastro',
        })
      }
      return res
    },
    {
      onSuccess: () => {
        toast.success('Produto atualizado!')
        queryClient.invalidateQueries('produtos')
        fecharForm()
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro ao atualizar')) },
    }
  )

  const deletarM = useMutation(
    (id: number) => api.delete(`/produtos/${id}`),
    {
      onSuccess: () => {
        toast.success('Produto removido')
        queryClient.invalidateQueries('produtos')
        setConfirmDel(null)
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro ao remover')) },
    }
  )

  const categoriasTree     = useMemo(() => buildTree(categorias || []), [categorias])
  const categoriasOrdenadas = useMemo(() => flattenTree(categoriasTree), [categoriasTree])

  const ajusteM = useMutation(
    (payload: any) => api.post('/estoque/ajuste', payload).then(r => r.data),
    {
      onSuccess: (data) => {
        toast.success(`Estoque atualizado. Saldo: ${data.saldo_atual}`)
        queryClient.invalidateQueries('produtos')
        setAjuste(null)
      },
      onError: (e: any) => { toast.error(mensagemErro(e, 'Erro no ajuste')) },
    }
  )

  const [ultimoCadastrado, setUltimoCadastrado] = useState<string | null>(null)

  function abrirNovo() {
    setEditando(null)
    setForm({ ...emptyForm })
    precoVenda.reset(); precoCusto.set(CUSTO_PADRAO)
    setCadastradosSessao(0)
    setUltimoCadastrado(null)
    setShowForm(true)
    setTimeout(() => barcodeInputRef.current?.focus(), 100)
  }

  /** Limpa o formulário pro próximo produto, mantendo categoria e unidade. */
  function proximoCadastro(nomeAnterior?: string) {
    setForm(f => ({ ...emptyForm, categoria_id: f.categoria_id, unidade_medida: f.unidade_medida }))
    precoVenda.reset(); precoCusto.set(CUSTO_PADRAO)
    setUltimoCadastrado(nomeAnterior || null)
    setTimeout(() => barcodeInputRef.current?.focus(), 0)
  }

  function alternarContinuo(v: boolean) {
    setContinuo(v)
    try { localStorage.setItem('estoque.cadastroContinuo', v ? '1' : '0') } catch { /* sem storage */ }
  }

  // ── Navegação por teclado no formulário de produto ──
  function camposDoForm(): HTMLElement[] {
    return Array.from(formRef.current?.querySelectorAll<HTMLElement>('[data-campo]') ?? [])
  }

  function focarCampo(nome: string) {
    setTimeout(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-campo="${nome}"]`)
      el?.focus()
    }, 0)
  }

  function moverFoco(atual: HTMLElement, passo: 1 | -1): boolean {
    const campos = camposDoForm()
    const i = campos.indexOf(atual)
    const alvo = campos[i + passo]
    if (i < 0 || !alvo) return false
    alvo.focus()
    return true
  }

  async function avisarSeCodigoExiste(codigo: string) {
    if (!codigo || editando) return
    try {
      const { data } = await api.get(`/produtos/barcode/${encodeURIComponent(codigo)}`)
      toast.error(`Código já cadastrado: "${data.nome}"`, { id: 'codigo-duplicado' })
      barcodeInputRef.current?.focus()
      barcodeInputRef.current?.select()
    } catch { /* 404 = código livre, segue o cadastro */ }
  }

  function onKeyDownForm(e: React.KeyboardEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement
    const campo = alvo.dataset?.campo
    if (e.key === 'Escape') { e.preventDefault(); fecharForm(); return }
    if (!campo) return  // botões e checkbox seguem o comportamento normal

    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) { salvar(); return }
      if (campo === 'codigo_barras') {
        // o leitor de código de barras manda Enter no fim da leitura
        moverFoco(alvo, 1)
        avisarSeCodigoExiste(form.codigo_barras.trim())
        return
      }
      if (!moverFoco(alvo, 1)) salvar()  // Enter no último campo cadastra
      return
    }

    const ehSelect = alvo.tagName === 'SELECT'
    const input = alvo as HTMLInputElement
    // ↑/↓ trocam de campo (nas listas, trocam a opção, como de costume)
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !ehSelect) {
      e.preventDefault()
      moverFoco(alvo, e.key === 'ArrowDown' ? 1 : -1)
      return
    }
    // ←/→ trocam de campo quando o cursor já está na ponta do texto
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (ehSelect) return
      const dinheiro = alvo.dataset.dinheiro !== undefined
      const tam = input.value.length
      const noFim    = input.selectionStart === tam && input.selectionEnd === tam
      const noInicio = input.selectionStart === 0 && input.selectionEnd === 0
      if (e.key === 'ArrowRight' && (dinheiro || noFim))    { if (moverFoco(alvo, 1))  e.preventDefault() }
      if (e.key === 'ArrowLeft'  && (dinheiro || noInicio)) { if (moverFoco(alvo, -1)) e.preventDefault() }
    }
  }

  // Campo de preço recém-focado: o 1º dígito substitui o valor (ex.: o custo padrão
  // R$ 0,01), igual aos campos de texto, que ficam selecionados ao entrar.
  const substituirPreco = useRef<string | null>(null)
  function teclaPreco(h: typeof precoVenda, campo: string) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (substituirPreco.current === campo && (/^\d$/.test(e.key) || e.key === 'Backspace')) {
        substituirPreco.current = null
        h.reset()
        if (e.key === 'Backspace') { e.preventDefault(); return }
      }
      h.onKeyDown(e)
    }
  }

  /** Ao entrar num campo de texto, seleciona o conteúdo pra digitar por cima. */
  function onFocusForm(e: React.FocusEvent<HTMLDivElement>) {
    const el = e.target as HTMLInputElement
    substituirPreco.current = el.dataset?.dinheiro !== undefined ? el.dataset.campo ?? null : null
    if (el.tagName === 'INPUT' && el.dataset?.campo && el.dataset.dinheiro === undefined) el.select()
  }

  function abrirEditar(p: Produto) {
    setEditando(p)
    setForm({
      nome: p.nome,
      codigo_barras: p.codigo_barras || '',
      fabricante: p.fabricante || '',
      categoria_id: String(p.categoria_id),
      preco_venda: String(p.preco_venda),
      preco_custo: String(p.preco_custo),
      unidade_medida: p.unidade_medida,
      estoque_atual: String(parseFloat(String(p.estoque_atual))),
      estoque_minimo: String(parseFloat(String(p.estoque_minimo))),
      descricao: '',
    })
    precoVenda.set(parseFloat(String(p.preco_venda)) || 0)
    precoCusto.set(parseFloat(String(p.preco_custo)) || 0)
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditando(null)
    setForm({ ...emptyForm })
    precoVenda.reset(); precoCusto.reset()
  }

  function salvar() {
    if (criarM.isLoading || editarM.isLoading) return
    if (!form.nome.trim()) { focarCampo('nome'); return toast.error('Nome é obrigatório') }
    if (!form.categoria_id) { focarCampo('categoria_id'); return toast.error('Selecione uma categoria') }
    if (precoVenda.float <= 0) { focarCampo('preco_venda'); return toast.error('Preço de venda inválido') }

    const payload: any = {
      nome: form.nome.trim(),
      codigo_barras: form.codigo_barras.trim() || undefined,
      fabricante: form.fabricante.trim() || undefined,
      categoria_id: parseInt(form.categoria_id),
      preco_venda: precoVenda.float,
      preco_custo: precoCusto.float,
      unidade_medida: form.unidade_medida,
      estoque_minimo: parseQtd(form.estoque_minimo),
    }

    if (editando) {
      editarM.mutate({
        id: editando.id,
        payload,
        estoqueAtualNovo: parseQtd(form.estoque_atual),
        estoqueAtualOriginal: editando.estoque_atual,
      })
    } else {
      payload.estoque_atual = parseQtd(form.estoque_atual)
      criarM.mutate(payload)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12" style={{ color: 'var(--clr-text-muted)' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--clr-border-2)', borderTopColor: 'var(--clr-green)' }} />
          <span className="text-sm">Carregando produtos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5" style={{ background: 'var(--clr-bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--clr-text)' }}>Estoque</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>
            {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''}
            {categoriaFiltro ? ' nesta categoria' : ' cadastrado' + (produtosFiltrados.length !== 1 ? 's' : '')}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          <input
            type="text"
            placeholder="Buscar produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="input w-52"
          />
          <select
            value={categoriaFiltro ?? ''}
            onChange={e => setCategoriaFiltro(e.target.value ? Number(e.target.value) : null)}
            className="input w-48"
          >
            <option value="">Todas as categorias</option>
            {catTree.map(c => (
              <option key={c.id} value={c.id}>
                {' '.repeat(c.nivel * 3)}{c.nivel > 0 ? '└ ' : ''}{c.nome}
              </option>
            ))}
          </select>
          {categoriaFiltro && (
            <button
              onClick={() => setCategoriaFiltro(null)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--clr-danger-bg)', color: 'var(--clr-danger)', border: '1px solid #FCA5A5' }}
            >
              ✕ Limpar
            </button>
          )}
          <button
            onClick={() => setShowCategorias(true)}
            className="text-sm font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
            style={{ color: 'var(--clr-text)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-green-pale)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-surface)'}
          >
            Categorias
          </button>
          <button
            onClick={exportarExcel}
            disabled={exportando}
            className="text-sm font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap disabled:opacity-50"
            style={{ color: 'var(--clr-text)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-green-pale)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-surface)'}
          >
            {exportando ? 'Gerando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={() => setShowImportarExcel(true)}
            className="text-sm font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
            style={{ color: 'var(--clr-text)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-green-pale)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-surface)'}
          >
            Importar Excel
          </button>
          <button onClick={abrirNovo} className="btn-action whitespace-nowrap" title="Atalho: F2">
            + Novo Produto
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div
        className="rounded-2xl overflow-hidden overflow-x-auto"
        style={{ border: '1px solid var(--clr-border)', background: 'var(--clr-surface)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--clr-border)', background: 'var(--clr-green-pale)' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Produto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Categoria</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Custo</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Preço</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Margem</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Estoque</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--clr-text-muted)' }}>Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.map((p: Produto, i: number) => (
              <tr
                key={p.id}
                style={{
                  borderBottom: '1px solid var(--clr-border)',
                  background: i % 2 === 0 ? 'var(--clr-surface)' : 'var(--clr-bg)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-green-pale)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'var(--clr-surface)' : 'var(--clr-bg)'}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold" style={{ color: 'var(--clr-text)' }}>{p.nome}</div>
                  {p.fabricante && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>{p.fabricante}</div>
                  )}
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>
                    {p.codigo_barras ? (
                      <span className="flex items-center gap-1">
                        <IconBarcode />
                        {p.codigo_barras}
                      </span>
                    ) : (
                      <span>Sem código</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--clr-green-lite)', color: 'var(--clr-green)' }}
                  >
                    {p.categoria_nome || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: 'var(--clr-text-muted)' }}>
                  {formatBRL(p.preco_custo)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-sm" style={{ color: 'var(--clr-text)' }}>
                  {formatBRL(p.preco_venda)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold" style={{ color: 'var(--clr-green-med)' }}>
                  {Number(p.margem_lucro).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ minWidth: 100 }}>
                  <span style={{ color: p.estoque_baixo ? 'var(--clr-danger)' : 'var(--clr-text)', fontWeight: p.estoque_baixo ? 700 : 400 }}>
                    {Number(p.estoque_atual).toFixed(p.unidade_medida === 'un' ? 0 : 3)} {p.unidade_medida}
                  </span>
                  <StockBar atual={p.estoque_atual} minimo={p.estoque_minimo} />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge atual={p.estoque_atual} minimo={p.estoque_minimo} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button
                      data-testid="acao-ajuste"
                      onClick={() => setAjuste({ produto: p, tipo: 'entrada', quantidade: '', observacao: '' })}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--clr-green)', background: 'var(--clr-green-pale)', border: '1px solid var(--clr-border)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-green-lite)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-green-pale)'}
                    >
                      Ajustar
                    </button>
                    <button
                      data-testid="acao-editar"
                      onClick={() => abrirEditar(p)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#DBEAFE'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#EFF6FF'}
                    >
                      Editar
                    </button>
                    <button
                      data-testid="acao-excluir"
                      onClick={() => setConfirmDel(p)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--clr-danger)', background: 'var(--clr-danger-bg)', border: '1px solid #FCA5A5' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEE2E2'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-danger-bg)'}
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {produtosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--clr-text-muted)' }}>
                  {categoriaFiltro ? 'Nenhum produto nesta categoria' : 'Nenhum produto encontrado'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Cadastrar / Editar Produto */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(25,40,25,0.55)', backdropFilter: 'blur(3px)' }}>
          <div
            ref={formRef}
            onKeyDown={onKeyDownForm}
            onFocus={onFocusForm}
            className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ border: '1px solid var(--clr-border)' }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--clr-border)', background: 'var(--clr-green-pale)' }}
            >
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--clr-text)' }}>
                  {editando ? `Editar Produto` : 'Novo Produto'}
                </h2>
                {editando && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>{editando.nome}</p>
                )}
                {!editando && cadastradosSessao > 0 && (
                  <p data-testid="cadastro-contador" className="text-xs mt-0.5" style={{ color: 'var(--clr-green)' }}>
                    {cadastradosSessao} cadastrado{cadastradosSessao !== 1 ? 's' : ''} agora
                    {ultimoCadastrado ? ` · último: ${ultimoCadastrado}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={fecharForm}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--clr-text-muted)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-border)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <IconClose />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Código de Barras</label>
                <input
                  ref={barcodeInputRef}
                  data-campo="codigo_barras"
                  type="text"
                  value={form.codigo_barras}
                  onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))}
                  className="input font-mono"
                  placeholder="Leia com o scanner ou digite manualmente"
                  autoComplete="off"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--clr-text-muted)' }}>
                  Aponte o leitor para o produto ou digite o código manualmente
                </p>
              </div>

              <div>
                <label className="label">Nome do Produto *</label>
                <input
                  type="text"
                  data-campo="nome"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="input"
                  placeholder="Ex: Arroz 5kg"
                />
              </div>

              <div>
                <label className="label">Fabricante / Marca</label>
                <input
                  type="text"
                  data-campo="fabricante"
                  value={form.fabricante}
                  onChange={e => setForm(f => ({ ...f, fabricante: e.target.value }))}
                  className="input"
                  placeholder="Ex: Nestlé, Piraquê..."
                />
              </div>

              <div>
                <label className="label">Categoria *</label>
                <select
                  data-testid="produto-categoria"
                  data-campo="categoria_id"
                  value={form.categoria_id}
                  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                  className="input"
                >
                  <option value="">-- Selecione --</option>
                  {categoriasOrdenadas.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.caminho}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Preço de Venda *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="produto-preco-venda"
                    data-campo="preco_venda"
                    data-dinheiro
                    value={precoVenda.display}
                    onKeyDown={teclaPreco(precoVenda, 'preco_venda')}
                    onChange={() => {}}
                    className="input font-mono text-right"
                  />
                </div>
                <div>
                  <label className="label">Preço de Custo</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="produto-preco-custo"
                    data-campo="preco_custo"
                    data-dinheiro
                    value={precoCusto.display}
                    onKeyDown={teclaPreco(precoCusto, 'preco_custo')}
                    onChange={() => {}}
                    className="input font-mono text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Unidade</label>
                  <select
                    data-testid="produto-unidade"
                    data-campo="unidade_medida"
                    value={form.unidade_medida}
                    onChange={e => setForm(f => ({ ...f, unidade_medida: e.target.value }))}
                    className="input"
                  >
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">{editando ? 'Estoque Atual' : 'Estoque Inicial'}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="produto-estoque"
                    data-campo="estoque_atual"
                    value={form.estoque_atual}
                    onChange={e => setForm(f => ({ ...f, estoque_atual: e.target.value }))}
                    className="input font-mono text-right"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="label">Estoque Mínimo</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    data-testid="produto-estoque-minimo"
                    data-campo="estoque_minimo"
                    value={form.estoque_minimo}
                    onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))}
                    className="input font-mono text-right"
                    placeholder="0"
                  />
                </div>
              </div>

              {form.preco_venda && form.preco_custo && parseFloat(form.preco_custo) > 0 && (
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: 'var(--clr-green-pale)', border: '1px solid var(--clr-border)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--clr-text-muted)' }}>Margem estimada</span>
                  <span data-testid="produto-margem" className="font-mono font-bold text-sm" style={{ color: 'var(--clr-green)' }}>
                    {(((parseFloat(form.preco_venda) - parseFloat(form.preco_custo)) / parseFloat(form.preco_custo)) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 pb-3 space-y-2">
              {!editando && (
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--clr-text-med)' }}>
                  <input
                    type="checkbox"
                    data-testid="cadastro-continuo"
                    checked={continuo}
                    onChange={e => alternarContinuo(e.target.checked)}
                  />
                  Continuar cadastrando (mantém categoria e unidade para o próximo)
                </label>
              )}
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--clr-text-muted)' }}>
                <b>Enter</b> próximo campo · <b>Enter</b> no último campo ou <b>Ctrl+Enter</b> salva ·
                {' '}<b>↑ ↓</b> sobe/desce (nas listas, troca a opção) · <b>← →</b> campo ao lado · <b>Esc</b> fecha
              </p>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={fecharForm} className="btn-bakery flex-1">Cancelar</button>
              <button
                data-testid="produto-salvar"
                onClick={salvar}
                disabled={criarM.isLoading || editarM.isLoading}
                className="btn-action flex-1"
              >
                {criarM.isLoading || editarM.isLoading ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajuste de Estoque */}
      {ajuste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(25,40,25,0.55)', backdropFilter: 'blur(3px)' }}>
          <div
            className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: '1px solid var(--clr-border)' }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--clr-border)', background: 'var(--clr-green-pale)' }}
            >
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--clr-text)' }}>Ajuste de Estoque</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>{ajuste.produto.nome}</p>
              </div>
              <button
                onClick={() => setAjuste(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--clr-text-muted)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-border)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <IconClose />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Tipo de movimentação</label>
                <select
                  data-testid="ajuste-tipo"
                  value={ajuste.tipo}
                  onChange={e => setAjuste({ ...ajuste, tipo: e.target.value })}
                  className="input"
                >
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste (define saldo final)</option>
                  <option value="perda">Perda</option>
                </select>
              </div>
              <div>
                <label className="label">
                  Quantidade {ajuste.tipo === 'ajuste' ? '(saldo final)' : ''}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  data-testid="ajuste-quantidade"
                  value={ajuste.quantidade}
                  onChange={e => setAjuste({ ...ajuste, quantidade: e.target.value })}
                  className="input text-xl font-mono text-center h-14"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Observação</label>
                <input
                  type="text"
                  value={ajuste.observacao}
                  onChange={e => setAjuste({ ...ajuste, observacao: e.target.value })}
                  className="input"
                  placeholder="Motivo do ajuste..."
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setAjuste(null)} className="btn-bakery flex-1">Cancelar</button>
              <button
                data-testid="ajuste-confirmar"
                onClick={() => ajusteM.mutate({
                  produto_id: ajuste.produto.id,
                  tipo: ajuste.tipo,
                  quantidade: parseQtd(ajuste.quantidade),
                  observacao: ajuste.observacao,
                })}
                disabled={!ajuste.quantidade || ajusteM.isLoading}
                className="btn-action flex-1"
              >
                {ajusteM.isLoading ? 'Salvando...' : 'Confirmar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gerenciar Categorias */}
      {showCategorias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(25,40,25,0.55)', backdropFilter: 'blur(3px)' }}>
          <div
            className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
            style={{ border: '1px solid var(--clr-border)' }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid var(--clr-border)', background: 'var(--clr-green-pale)' }}
            >
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--clr-text)' }}>Categorias</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>
                  {(categorias || []).length} cadastrada{(categorias || []).length !== 1 ? 's' : ''} · hierárquica
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCategorias(false); setConfirmDelCat(null)
                  setNovaCategoria(''); setNovoParentId(''); setMovendoCat(null)
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--clr-text-muted)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-border)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <IconClose />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <form
                onSubmit={e => {
                  e.preventDefault()
                  const nome = novaCategoria.trim()
                  if (!nome) return toast.error('Informe o nome da categoria')
                  criarCategoriaM.mutate({
                    nome,
                    parent_id: novoParentId ? parseInt(novoParentId) : null,
                  })
                }}
                className="space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novaCategoria}
                    onChange={e => setNovaCategoria(e.target.value)}
                    className="input flex-1"
                    placeholder="Nova categoria..."
                    maxLength={60}
                  />
                  <button
                    type="submit"
                    disabled={criarCategoriaM.isLoading || !novaCategoria.trim()}
                    className="btn-action whitespace-nowrap"
                  >
                    {criarCategoriaM.isLoading ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--clr-text-muted)' }}>
                    Criar dentro de:
                  </label>
                  <select
                    data-testid="categoria-pai"
                    value={novoParentId}
                    onChange={e => setNovoParentId(e.target.value)}
                    className="input text-sm"
                    style={novoParentId ? { borderColor: 'var(--clr-green)', background: 'var(--clr-green-pale)' } : undefined}
                  >
                    <option value="">— Categoria raiz (sem pai)</option>
                    {categoriasOrdenadas.map(c => (
                      <option key={c.id} value={c.id}>{c.caminho}</option>
                    ))}
                  </select>
                  {novoParentId && (
                    <button
                      type="button"
                      onClick={() => setNovoParentId('')}
                      className="text-xs mt-1 underline"
                      style={{ color: 'var(--clr-text-muted)' }}
                    >
                      Limpar (voltar a criar como raiz)
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-1">
                {categoriasOrdenadas.map(c => {
                  const emUso = (produtos || []).filter((p: Produto) => p.categoria_id === c.id).length
                  const ehConfirm = confirmDelCat?.id === c.id
                  const movendo   = movendoCat === c.id
                  const temFilhos = c.filhos.length > 0
                  // Bloqueia escolher como pai: ele mesmo OU qualquer descendente
                  const descendentes = new Set<number>()
                  const coletar = (n: CategoriaNode) => { descendentes.add(n.id); n.filhos.forEach(coletar) }
                  coletar(c)
                  return (
                    <div
                      key={c.id}
                      data-testid="categoria-item"
                      data-nome={c.nome}
                      data-nivel={c.nivel}
                      className="relative flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                      style={{
                        background: c.nivel === 0 ? 'var(--clr-green-pale)' : 'var(--clr-bg)',
                        border: '1px solid var(--clr-border)',
                        marginLeft: c.nivel * 28,
                        borderLeft: c.nivel > 0 ? '3px solid var(--clr-green-med)' : '1px solid var(--clr-border)',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        {editandoCat === c.id ? (
                          <form
                            className="flex items-center gap-1 mb-1"
                            onSubmit={e => {
                              e.preventDefault()
                              const nome = editNomeCat.trim()
                              if (!nome) return toast.error('Nome não pode ser vazio')
                              renomearCategoriaM.mutate({ id: c.id, nome })
                            }}
                          >
                            <input
                              autoFocus
                              value={editNomeCat}
                              onChange={e => setEditNomeCat(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Escape') setEditandoCat(null) }}
                              className="input text-sm flex-1 py-1 h-8"
                              maxLength={80}
                            />
                            <button
                              type="submit"
                              disabled={renomearCategoriaM.isLoading}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background: 'var(--clr-green)', color: '#fff', border: 'none', flexShrink: 0 }}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoCat(null)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center"
                              style={{ background: 'var(--clr-border)', color: 'var(--clr-text-muted)', border: 'none', flexShrink: 0 }}
                            >
                              ✕
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditandoCat(c.id); setEditNomeCat(c.nome); setMovendoCat(null); setConfirmDelCat(null) }}
                            className="font-medium text-sm text-left w-full truncate flex items-center gap-1.5 group"
                            style={{
                              color: 'var(--clr-text)',
                              fontWeight: c.nivel === 0 ? 700 : 500,
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'text',
                            }}
                            title="Clique para editar o nome"
                          >
                            {c.nome}
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"/>
                            </svg>
                          </button>
                        )}
                        {c.nivel > 0 && c.caminho.includes('›') && (
                          <div className="text-[11px] truncate" style={{ color: 'var(--clr-text-muted)' }}>
                            em {c.caminho.split(' › ').slice(0, -1).join(' › ')}
                          </div>
                        )}
                        <div className="text-xs mt-0.5" style={{ color: 'var(--clr-text-muted)' }}>
                          {emUso} produto{emUso !== 1 ? 's' : ''}
                          {temFilhos && ` · ${c.filhos.length} subcategoria${c.filhos.length !== 1 ? 's' : ''}`}
                        </div>
                        {movendo && (
                          <select
                            autoFocus
                            defaultValue={c.parent_id ? String(c.parent_id) : ''}
                            onChange={e => {
                              const v = e.target.value
                              moverCategoriaM.mutate({
                                id: c.id,
                                parent_id: v ? parseInt(v) : null,
                              })
                            }}
                            className="input text-xs mt-2"
                          >
                            <option value="">— Categoria raiz (sem pai)</option>
                            {categoriasOrdenadas
                              .filter(opt => !descendentes.has(opt.id))
                              .map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.caminho}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                      {ehConfirm ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setConfirmDelCat(null)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg"
                            style={{ color: 'var(--clr-text)', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)' }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => deletarCategoriaM.mutate(c.id)}
                            disabled={deletarCategoriaM.isLoading}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                            style={{ background: 'var(--clr-danger)', color: '#fff', border: 'none' }}
                          >
                            {deletarCategoriaM.isLoading ? 'Removendo...' : 'Confirmar'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setMovendoCat(movendo ? null : c.id)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
                            style={{ color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE' }}
                          >
                            {movendo ? 'Fechar' : 'Mover'}
                          </button>
                          <button
                            onClick={() => setConfirmDelCat(c)}
                            disabled={temFilhos}
                            title={temFilhos ? 'Remova ou mova as subcategorias antes' : ''}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: 'var(--clr-danger)', background: 'var(--clr-danger-bg)', border: '1px solid #FCA5A5' }}
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {(categorias || []).length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--clr-text-muted)' }}>
                    Nenhuma categoria cadastrada
                  </p>
                )}
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--clr-text-muted)' }}>
                Use "Mover" para reorganizar a hierarquia. Categorias com subcategorias precisam ser esvaziadas antes de remover.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Remoção */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(25,40,25,0.55)', backdropFilter: 'blur(3px)' }}>
          <div
            className="bg-white w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center"
            style={{ border: '1px solid var(--clr-border)' }}
          >
            <div className="flex justify-center mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--clr-warning-bg)' }}
              >
                <IconWarning />
              </div>
            </div>
            <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--clr-text)' }}>Remover Produto?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--clr-text-muted)' }}>
              <strong style={{ color: 'var(--clr-text)' }}>{confirmDel.nome}</strong> será desativado e não aparecerá mais no PDV.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="btn-bakery flex-1">Cancelar</button>
              <button
                onClick={() => deletarM.mutate(confirmDel.id)}
                disabled={deletarM.isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors"
                style={{ background: 'var(--clr-danger)', color: '#fff', border: 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#991B1B'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clr-danger)'}
              >
                {deletarM.isLoading ? 'Removendo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportarExcel && (
        <ImportarExcelModal
          onClose={() => setShowImportarExcel(false)}
          onSuccess={() => setShowImportarExcel(false)}
        />
      )}
    </div>
  )
}
