import { useState, useEffect, useRef } from 'react'
import { fmtQtd } from '@/utils/formatQtd'

interface Produto {
  nome: string
  preco_venda: number
  unidade_medida: string
}

interface Props {
  aberto: boolean
  produto: Produto | null
  onConfirmar: (quantidade: number) => void
  onCancelar: () => void
}

const COR = {
  bg: '#0a0a0b',
  surface: '#1a1a1c',
  surface2: '#222224',
  header: '#141416',
  border: 'rgba(255,255,255,0.08)',
  borderSoft: 'rgba(255,255,255,0.06)',
  text: '#f5f5f5',
  muted: '#9ca3af',
  verde: '#22c55e',
  verdePale: 'rgba(34,197,94,0.1)',
  verdeBorder: 'rgba(34,197,94,0.2)',
  disabled: '#1a3a1a',
  disabledText: '#4b7a4b',
}

export default function PesoModal({ aberto, produto, onConfirmar, onCancelar }: Props) {
  const [quantidade, setQuantidade] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      setQuantidade('')
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [aberto])

  if (!aberto || !produto) return null

  const unidade = produto.unidade_medida
  const step = unidade === 'kg' || unidade === 'l' ? '0.001' : '1'
  const qtdNum = parseFloat(quantidade.replace(',', '.')) || 0
  const total = qtdNum * produto.preco_venda
  const valido = qtdNum > 0

  const confirmar = () => { if (valido) onConfirmar(qtdNum) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmar()
    if (e.key === 'Escape') onCancelar()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancelar() }}
    >
      <div
        className="w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: COR.surface, border: `1px solid ${COR.border}` }}
      >
        {/* Header */}
        <div className="px-5 py-4" style={{ background: COR.header, borderBottom: `1px solid ${COR.borderSoft}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COR.muted }}>
            Informe a quantidade
          </p>
          <p className="text-base font-bold mt-0.5 truncate" style={{ color: COR.text }}>
            {produto.nome}
          </p>
          <p className="text-sm mt-0.5">
            <span style={{ color: COR.verde }}>
              R$ {produto.preco_venda.toFixed(2).replace('.', ',')}
            </span>
            <span style={{ color: COR.muted }}> / {unidade}</span>
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: COR.muted }}>
              Quantidade <span style={{ color: COR.verde }}>({unidade})</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="number"
                step={step}
                min="0"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="flex-1 px-4 py-3 rounded-xl text-xl font-mono font-bold text-center outline-none"
                style={{
                  background: COR.surface2,
                  border: `1px solid ${COR.border}`,
                  color: COR.text,
                }}
              />
              <span
                className="text-sm font-bold w-10 text-center shrink-0"
                style={{ color: COR.muted }}
              >
                {unidade}
              </span>
            </div>
          </div>

          {/* Preview total */}
          {valido && (
            <div
              className="px-4 py-2.5 rounded-xl flex items-center justify-between"
              style={{ background: COR.verdePale, border: `1px solid ${COR.verdeBorder}` }}
            >
              <span className="text-xs" style={{ color: COR.muted }}>
                {fmtQtd(qtdNum, unidade)} × R$ {produto.preco_venda.toFixed(2).replace('.', ',')}
              </span>
              <span className="font-bold text-sm" style={{ color: COR.verde }}>
                R$ {total.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div
          className="flex gap-2.5 px-5 py-4"
          style={{ borderTop: `1px solid ${COR.borderSoft}`, background: COR.header }}
        >
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: COR.surface2, border: `1px solid ${COR.border}`, color: '#d1d5db' }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!valido}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{
              background: valido ? COR.verde : COR.disabled,
              color: valido ? '#0a0a0a' : COR.disabledText,
            }}
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  )
}
