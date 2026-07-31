import { useState, useEffect } from 'react'
import { authApi } from '@/services/authService'
import { getToken, setToken } from '@/services/api'
import { toDisplayUser } from '@/utils/helpers'
import type { User } from '@/types/auth'
import type { Page } from '@/types/navigation'

/**
 * Kimlik doğrulama durumunu ve login/logout akışını yönetir. Sayfa geçişleri
 * (setPage) auth akışına bağlı olduğu için (örn. token doğrulanınca dashboard'a
 * geçmek) bir callback olarak dışarıdan alınır - böylece routing App.tsx'te kalır.
 */
export function useAuth(onNavigateAfterAuth: (page: Page) => void) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    if (!getToken()) { setAuthChecked(true); return }
    (async () => {
      try {
        const me = await authApi.me()
        setCurrentUser(toDisplayUser(me))
        onNavigateAfterAuth('dashboard')
      } catch {
        setToken(null)
      } finally {
        setAuthChecked(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (user: User) => {
    setCurrentUser(user)
    onNavigateAfterAuth('dashboard')
  }

  const logout = () => {
    authApi.logout().catch(() => {})
    setToken(null)
    setCurrentUser(null)
    onNavigateAfterAuth('login')
  }

  return { currentUser, authChecked, login, logout }
}
