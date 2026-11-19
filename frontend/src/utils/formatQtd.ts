/** Unidades que usam casas decimais (peso/volume vendido por fração). */
const UNIDADES_FRACIONADAS = new Set(['kg', 'l'])

/**
 * Formata quantidade com unidade para exibição ao operador.
 * kg/l → 3 casas decimais, vírgula BR: "1,250 kg", "0,500 l"
 * g/ml/un/pct → inteiro ou fração mínima: "200 g", "3 un"
 */
export function fmtQtd(qty: number, unit: string): string {
  if (UNIDADES_FRACIONADAS.has(unit)) {
    return qty.toFixed(3).replace('.', ',') + ' ' + unit
  }
  const s = Number.isInteger(qty) ? qty.toString() : qty.toFixed(3).replace('.', ',')
  return s + ' ' + unit
}

/** Passo dos botões +/− no carrinho baseado na unidade do produto. */
export function stepParaUnidade(unit: string): number {
  if (unit === 'kg' || unit === 'l') return 0.1
  if (unit === 'g' || unit === 'ml') return 50
  return 1
}

/** Retorna true para unidades que requerem entrada de peso no PDV. */
export function isPeso(unit: string): boolean {
  return ['kg', 'g', 'l', 'ml'].includes(unit)
}
