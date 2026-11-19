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

const MASKED_UNITS = new Set(['kg', 'l'])

function formatMasked(digits: string): string {
  if (!digits) return ''
  const padded = digits.padStart(4, '0')
  const intPart = parseInt(padded.slice(0, -3), 10).toString()
  const decPart = padded.slice(-3)
  return `${intPart},${decPart}`
}

export default function PesoModal({ aberto, produto, onConfirmar, onCancelar }: Props) {
  const [digits, setDigits] = useState('')
  const [rawQtd, setRawQtd] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      setDigits('')
      setRawQtd('')
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [aberto])

  if (!aberto || !produto) return null

  const unidade = produto.unidade_medida
  const isMasked = MASKED_UNITS.has(unidade)

  const qtdNum = isMasked
    ? (digits ? parseInt(digits, 10) / 1000 : 0)
    : (parseFloat(rawQtd.replace(',', '.')) || 0)

  const displayValue = isMasked ? formatMasked(digits) : rawQtd
  const total = qtdNum * produto.preco_venda
  const valido = qtdNum > 0

  const confirmar = () => { if (valido) onConfirmar(qtdNum) }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { confirmar(); return }
    if (e.key === 'Escape') { onCancelar(); return }
    if (!isMasked) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      setDigits(prev => prev.slice(0, -1))
      return
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      setDigits(prev => (prev + e.key).slice(-7))
      return
    }
    if (!['Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isMasked) {
      setDigits(e.target.value.replace(/\D/g, '').slice(-7))
    } else {
      setRawQtd(e.target.value)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancelar() }}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Produto */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#6b7280' }}>
            Quantidade
          </p>
          <p className="font-bold text-base leading-tight truncate" style={{ color: '#f5f5f5' }}>
            {produto.nome}
          </p>
          <p className="text-sm mt-0.5">
            <span style={{ color: '#22c55e' }}>R$ {produto.preco_venda.toFixed(2).replace('.', ',')}</span>
            <span style={{ color: '#6b7280' }}> / {unidade}</span>
          </p>
        </div>

        {/* Display numérico */}
        <div
          className="rounded-xl px-4 py-5 flex items-center justify-center gap-3 cursor-text"
          style={{ background: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            type={isMasked ? 'text' : 'number'}
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="sr-only"
            tabIndex={0}
          />
          <span
            className="text-4xl font-mono font-bold tracking-tight"
            style={{ color: valido ? '#f5f5f5' : '#3a3a3c' }}
          >
            {displayValue || (isMasked ? '0,000' : '0')}
          </span>
          <span className="text-lg font-semibold" style={{ color: '#4b5563' }}>
            {unidade}
          </span>
        </div>

        {/* Total */}
        {valido ? (
          <div
            className="rounded-xl px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}
          >
            <span className="text-xs" style={{ color: '#6b7280' }}>
              {fmtQtd(qtdNum, unidade)} × R$ {produto.preco_venda.toFixed(2).replace('.', ',')}
            </span>
            <span className="font-bold text-sm" style={{ color: '#22c55e' }}>
              R$ {total.toFixed(2).replace('.', ',')}
            </span>
          </div>
        ) : (
          <p className="text-xs text-center" style={{ color: '#3a3a3c' }}>
            Digite a quantidade para ver o total
          </p>
        )}

        {/* Botões */}
        <div className="flex gap-2.5 pt-1">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#222224', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!valido}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: valido ? '#22c55e' : '#1c2b1c',
              color: valido ? '#0a0a0a' : '#2d4a2d',
            }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
