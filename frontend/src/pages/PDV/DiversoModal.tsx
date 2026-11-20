import { useState, useEffect, useRef } from 'react'

interface Props {
  aberto: boolean
  onConfirmar: (preco: number, quantidade: number) => void
  onCancelar: () => void
}

function centavosParaFloat(centavos: string): number {
  return parseInt(centavos || '0', 10) / 100
}

function formatarMascara(centavos: string): string {
  const num = parseInt(centavos || '0', 10)
  return (num / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function DiversoModal({ aberto, onConfirmar, onCancelar }: Props) {
  const [precoCentavos, setPrecoCentavos] = useState('0')
  const [quantidade, setQuantidade] = useState('1')
  const [erro, setErro] = useState('')
  const precoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      setPrecoCentavos('0')
      setQuantidade('1')
      setErro('')
      setTimeout(() => precoRef.current?.focus(), 50)
    }
  }, [aberto])

  const handlePrecoKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      setPrecoCentavos(v => v.length <= 1 ? '0' : v.slice(0, -1))
      return
    }
    if (e.key === 'Enter') { handleConfirmar(); return }
    if (!/^\d$/.test(e.key)) return
    e.preventDefault()
    setPrecoCentavos(v => {
      const novo = v === '0' ? e.key : v + e.key
      return novo.replace(/^0+(\d)/, '$1').slice(0, 10)
    })
  }

  const precoFloat = centavosParaFloat(precoCentavos)
  const quantidadeFloat = parseFloat(quantidade) || 0

  const handleConfirmar = () => {
    setErro('')
    if (precoFloat <= 0) { setErro('Preço deve ser maior que zero'); return }
    if (quantidadeFloat <= 0) { setErro('Quantidade deve ser maior que zero'); return }
    onConfirmar(precoFloat, quantidadeFloat)
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-2xl p-6 w-96 max-w-full border border-slate-700 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-4">Produto Diverso</h2>

        <div className="space-y-4">
          {/* Preço */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Preço *
            </label>
            <input
              ref={precoRef}
              type="text"
              inputMode="numeric"
              value={formatarMascara(precoCentavos)}
              onKeyDown={handlePrecoKeyDown}
              onChange={() => {}}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg font-bold tracking-wide focus:outline-none focus:border-green-500 cursor-text"
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Quantidade
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Erro */}
          {erro && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {erro}
            </div>
          )}

          {/* Resumo */}
          {precoFloat > 0 && quantidadeFloat > 0 && !erro && (
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-600">
              <p className="text-xs text-slate-400">Total (sem desconto):</p>
              <p className="text-lg font-bold text-green-400">
                {(precoFloat * quantidadeFloat).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancelar}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
