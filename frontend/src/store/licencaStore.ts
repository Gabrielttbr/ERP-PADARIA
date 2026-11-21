import { create } from 'zustand'

export interface StatusLicenca {
  situacao: 'ok' | 'aviso' | 'bloqueada'
  sem_chave: boolean
  cliente: string | null
  expira_em: string
  dias_restantes: number
  dias_aviso: number
  mensagem: string
}

interface LicencaState {
  status: StatusLicenca | null
  setStatus: (s: StatusLicenca) => void
  /** Chamado pelo interceptor quando a API responde 402 (chave venceu no meio do uso) */
  marcarBloqueada: (mensagem: string) => void
}

export const useLicencaStore = create<LicencaState>()((set, get) => ({
  status: null,
  setStatus: (status) => set({ status }),
  marcarBloqueada: (mensagem) => {
    const atual = get().status
    set({
      status: {
        situacao: 'bloqueada',
        sem_chave: atual?.sem_chave ?? false,
        cliente: atual?.cliente ?? null,
        expira_em: atual?.expira_em ?? '',
        dias_restantes: Math.min(atual?.dias_restantes ?? -1, -1),
        dias_aviso: atual?.dias_aviso ?? 5,
        mensagem,
      },
    })
  },
}))
