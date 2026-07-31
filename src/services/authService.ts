import { api, setToken } from './api'
import type { AuthUser } from '@/types/auth'

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: AuthUser; token: string }> => {
    const res = await api.post<{ user: AuthUser; token: string }>('/auth/login', { email, password })
    setToken(res.token)
    return res
  },

  logout: async () => {
    await api.post('/auth/logout')
    setToken(null)
  },

  me: () => api.get<AuthUser>('/auth/me'),
}
