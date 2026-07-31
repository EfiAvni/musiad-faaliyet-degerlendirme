import type { User } from '@/types/auth'

export function usePermissions(user: User | null) {
  return {
    isSuperAdmin: user?.role === 'superadmin',
    isBirimYoneticisi: user?.role === 'birim_yoneticisi',
    isSubeYoneticisi: user?.role === 'sube_yoneticisi',
  }
}
