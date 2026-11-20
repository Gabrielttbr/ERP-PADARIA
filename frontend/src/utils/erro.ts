/**
 * Mensagem legível a partir de um erro do axios/API.
 *
 * O FastAPI devolve `detail` como string (HTTPException) ou como LISTA de
 * objetos (erro de validação 422 do Pydantic). Passar a lista direto para o
 * toast.error faz o React quebrar ("Objects are not valid as a React child")
 * e a tela fica branca — por isso toda mensagem de erro passa por aqui.
 */
export function mensagemErro(err: unknown, padrao = 'Erro inesperado'): string {
  const detail = (err as any)?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d: any) => (typeof d === 'string' ? d : d?.msg))
      .filter((m: unknown): m is string => typeof m === 'string' && m.length > 0)
      .map(m => m.replace(/^Value error, /, ''))
    if (msgs.length) return msgs.join('; ')
  }
  return padrao
}
