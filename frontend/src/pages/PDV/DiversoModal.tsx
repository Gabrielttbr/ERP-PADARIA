import { useState, useEffect } from 'react'

interface Props {
  aberto: boolean
  onConfirmar: (preco: number, quantidade: number) => void
  onCancelar: () => void
}

export default function DiversoModal({ aberto, onConfirmar, onCancelar }: Props) {
  const [preco, setPreco] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (aberto) {
      setPreco('')
      setQuantidade('1')
      setErro('')
    }
  }, [aberto])

  const handleConfirmar = () => {
    setErro('')

    // Validações
    if (!preco || parseFloat(preco) <= 0) {
      setErro('Preço deve ser maior que zero')
      return
    }

    if (!quantidade || parseFloat(quantidade) <= 0) {
      setErro('Quantidade deve ser maior que zero')
      return
    }

    onConfirmar(parseFloat(preco), parseFloat(quantidade))
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
              Preço (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
              autoFocus
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
          {preco && quantidade && !erro && (
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-600">
              <p className="text-xs text-slate-400">Total (sem desconto):</p>
              <p className="text-lg font-bold text-green-400">
                R$ {(parseFloat(preco) * parseFloat(quantidade)).toFixed(2)}
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
