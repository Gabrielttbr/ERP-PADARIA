import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '@/config/api'
import { useAuthStore } from '@/store/authStore'
import { StatusLicenca, useLicencaStore } from '@/store/licencaStore'
import { mensagemErro } from '@/utils/erro'

const DEZ_MINUTOS = 10 * 60 * 1000

export async function carregarStatusLicenca() {
  const { data } = await api.get<StatusLicenca>('/licenca/status')
  useLicencaStore.getState().setStatus(data)
  return data
}

/** Campo para colar a chave nova — usado na tela de bloqueio e em Configurações. */
export function AtivarChaveForm({ onAtivada }: { onAtivada?: () => void }) {
  const [chave, setChave] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function ativar() {
    if (!chave.trim()) return
    setEnviando(true)
    try {
      const { data } = await api.post<StatusLicenca>('/licenca/ativar', { chave })
      useLicencaStore.getState().setStatus(data)
      setChave('')
      toast.success(data.mensagem)
      onAtivada?.()
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível ativar a chave de acesso'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="label" htmlFor="chave-acesso">Nova chave de acesso</label>
      <textarea
        id="chave-acesso"
        data-testid="campo-chave-acesso"
        className="input font-mono text-xs min-h-[90px]"
        value={chave}
        onChange={e => setChave(e.target.value)}
        placeholder="Cole aqui a chave enviada pelo responsável pelo sistema (começa com GN1.)"
        spellCheck={false}
      />
      <button
        onClick={ativar}
        disabled={enviando || !chave.trim()}
        className="btn-primary w-full disabled:opacity-50"
      >
        {enviando ? 'Ativando...' : 'Ativar chave de acesso'}
      </button>
    </div>
  )
}

function TelaBloqueio({ status }: { status: StatusLicenca }) {
  const logout = useAuthStore(s => s.logout)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'var(--clr-bg)' }}>
      <div data-testid="tela-licenca-bloqueada" className="card w-full max-w-lg space-y-5">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold" style={{ color: '#1C140D' }}>
            {status.sem_chave ? 'Chave de acesso necessária' : 'Chave de acesso vencida'}
          </h1>
          <p className="text-sm" style={{ color: '#4E3F34' }}>{status.mensagem}</p>
          {status.cliente && (
            <p className="text-xs" style={{ color: 'var(--clr-text-muted)' }}>Cliente: {status.cliente}</p>
          )}
        </div>
        <AtivarChaveForm />
        <button
          onClick={() => { logout(); window.location.href = '/login' }}
          className="text-xs underline w-full text-center"
          style={{ color: 'var(--clr-text-muted)' }}
        >
          Sair
        </button>
      </div>
    </div>
  )
}

function AvisoLicenca({ status }: { status: StatusLicenca }) {
  return (
    <div
      data-testid="aviso-licenca"
      role="alert"
      className="shrink-0 px-4 py-2 text-sm font-medium text-center"
      style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}
    >
      <svg viewBox="0 0 24 24" className="inline w-4 h-4 mr-1.5 -mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      {status.mensagem}{' '}
      <Link to="/configuracoes?aba=licenca" className="underline font-bold whitespace-nowrap">Colar nova chave</Link>
    </div>
  )
}

/**
 * Envolve todas as telas logadas: mostra o aviso nos últimos dias da chave e
 * troca tudo pela tela de bloqueio quando ela vence.
 */
export default function LicencaGuard() {
  const status = useLicencaStore(s => s.status)

  useEffect(() => {
    carregarStatusLicenca().catch(() => {})
    const t = setInterval(() => carregarStatusLicenca().catch(() => {}), DEZ_MINUTOS)
    return () => clearInterval(t)
  }, [])

  if (status?.situacao === 'bloqueada') return <TelaBloqueio status={status} />
  if (status?.situacao !== 'aviso') return <Outlet />

  return (
    <div className="flex flex-col h-full w-full">
      <AvisoLicenca status={status} />
      {/* transform cria um "containing block": telas com position:fixed (PDV)
          ficam abaixo do aviso em vez de cobri-lo */}
      <div className="relative flex-1 min-h-0" style={{ transform: 'translateZ(0)' }}>
        <Outlet />
      </div>
    </div>
  )
}
