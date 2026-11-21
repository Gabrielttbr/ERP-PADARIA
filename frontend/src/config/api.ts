import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { useLicencaStore } from '@/store/licencaStore'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Injeta Bearer token em todas as requisições
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Tenta refresh quando recebe 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    // Chave de acesso venceu: o LicencaGuard troca a tela pelo bloqueio
    if (error.response?.status === 402 && error.response.data?.codigo === 'licenca_bloqueada') {
      useLicencaStore.getState().marcarBloqueada(error.response.data.detail)
      return Promise.reject(error)
    }
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) throw new Error('no refresh token')

        const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
