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

/** Unidades com 3 casas decimais (máscara: digitar → formatar automaticamente). */
const MASKED_UNITS = new Set(['kg', 'l'])

/**
 * Formata string de dígitos em "inteiro,decimal" com 3 casas fixas.
 * "2"    → "0,002"
 * "200"  → "0,200"
 * "2000" → "2,000"
 * "1250" → "1,250"
 */
function formatMasked(digits: string): string {
  if (!digits) return ''
  const padded = digits.padStart(4, '0')
  const intPart = parseInt(padded.slice(0, -3), 10).toString()
  const decPart = padded.slice(-3)
  return `${intPart},${decPart}`
}

export default function PesoModal({ aberto, produto, onConfirmar, onCancelar }: Props) {
  // Para kg/l: apenas dígitos (máscara automática)
  const [digits, setDigits] = useState('')
  // Para g/ml: valor bruto do input numérico
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
      setDigits(prev => (prev + e.key).slice(-7)) // máx 9.999,999
      return
    }

    // Bloqueia qualquer outra tecla no modo máscara (vírgula, ponto, letras…)
    if (!['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isMasked) {
      // Fallback para colar/mobile: extrai só os dígitos
      const raw = e.target.value.replace(/\D/g, '').slice(-7)
      setDigits(raw)
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
              {isMasked && (
                <span className="ml-2 font-normal" style={{ color: '#4b4b4d' }}>
                  — digite os algarismos
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type={isMasked ? 'text' : 'number'}
                inputMode="numeric"
                step={isMasked ? undefined : '1'}
                min={isMasked ? undefined : '0'}
                value={displayValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={isMasked ? '0,000' : '0'}
                className="flex-1 px-4 py-3 rounded-xl text-2xl font-mono font-bold text-center outline-none"
                style={{
                  background: COR.surface2,
                  border: `1px solid ${COR.border}`,
                  color: valido ? COR.text : COR.muted,
                }}
              />
              <span
                className="text-sm font-bold w-10 text-center shrink-0"
                style={{ color: COR.muted }}
              >
                {unidade}
              </span>
            </div>
            {isMasked && (
              <p className="text-[11px] mt-1.5 text-center" style={{ color: '#4b4b4d' }}>
                Ex: digitar <kbd className="px-1 rounded" style={{ background: COR.surface2 }}>2</kbd>
                <kbd className="px-1 rounded ml-0.5" style={{ background: COR.surface2 }}>0</kbd>
                <kbd className="px-1 rounded ml-0.5" style={{ background: COR.surface2 }}>0</kbd>
                → 0,200 {unidade}
              </p>
            )}
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
