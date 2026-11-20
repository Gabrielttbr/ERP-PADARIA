const FUSO = 'America/Sao_Paulo'

/** Data (yyyy-MM-dd) em São Paulo, deslocada em dias a partir de hoje. */
export function diaSP(deslocamentoDias = 0): string {
  const d = new Date(Date.now() + deslocamentoDias * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: FUSO })
}

/** "dd/MM" de uma data yyyy-MM-dd. */
export function ddMM(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Hora atual (HH:mm) em São Paulo. */
export function horaSP(deslocamentoMin = 0): string {
  return new Date(Date.now() + deslocamentoMin * 60_000)
    .toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
}
