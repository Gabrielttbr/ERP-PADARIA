import { useState, useCallback } from 'react'

function floatToCentavos(val: number): string {
  return String(Math.round(val * 100))
}

export function formatCurrencyDisplay(centavos: string): string {
  const num = parseInt(centavos || '0', 10)
  return (num / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function useCurrencyInput(initial = 0) {
  const [centavos, setCentavos] = useState(() => initial > 0 ? floatToCentavos(initial) : '0')

  const display = formatCurrencyDisplay(centavos)
  const float   = parseInt(centavos || '0', 10) / 100

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      setCentavos(v => v.length <= 1 ? '0' : v.slice(0, -1))
      return
    }
    if (!/^\d$/.test(e.key)) return
    e.preventDefault()
    setCentavos(v => {
      const novo = v === '0' ? e.key : v + e.key
      return novo.replace(/^0+(\d)/, '$1').slice(0, 10)
    })
  }, [])

  const set = useCallback((val: number) => {
    setCentavos(val > 0 ? floatToCentavos(val) : '0')
  }, [])

  const reset = useCallback(() => setCentavos('0'), [])

  return { display, float, onKeyDown, set, reset }
}
