import type { AuthUser, User } from '@/types/auth'
import { mockUsers, roleLabels } from './constants'

export function toDisplayUser(authUser: AuthUser): User {
  const mock = mockUsers.find(u => u.email === authUser.email)
  const initials = authUser.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return {
    ...(mock ?? {
      id: authUser.id, name: authUser.name, email: authUser.email,
      password: '', role: authUser.role, roleLabel: roleLabels[authUser.role] ?? authUser.role, initials,
    }),
    role: authUser.role,
    birim_id: authUser.birim_id, sube_id: authUser.sube_id,
  }
}

export function raporTabClass(active: boolean) {
  return `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`
}
