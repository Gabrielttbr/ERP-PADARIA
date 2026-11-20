import type { Locator } from '@playwright/test'

/** R$ formatado igual ao formatBRL do app ("R$ 1.234,56", com espaço não separável). */
export function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Regex que casa o valor em R$ independente do tipo de espaço após "R$". */
export function reBrl(valor: number): RegExp {
  const num = brl(valor).replace(/^R\$\s*/, '').replace(/\./g, '\\.')
  return new RegExp(`R\\$\\s*${num}(?!\\d)`)
}

/**
 * Digita um valor num campo de moeda do app (useCurrencyInput), que aceita só
 * teclas de dígito e desloca os centavos: "20,00" → teclas 2,0,0,0.
 */
export async function digitarValor(campo: Locator, valor: string | number): Promise<void> {
  const centavos = typeof valor === 'number'
    ? String(Math.round(valor * 100))
    : valor.replace(/\D/g, '')
  await campo.click()
  for (let i = 0; i < 12; i++) await campo.press('Backspace')
  for (const d of centavos) await campo.press(d)
}
