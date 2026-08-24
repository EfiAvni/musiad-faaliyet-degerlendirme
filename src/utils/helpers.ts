import type { AuthUser, User } from '@/types/auth'
import { roleLabels } from './constants'

export function toDisplayUser(authUser: AuthUser): User {
  return { ...authUser, roleLabel: roleLabels[authUser.role] ?? authUser.role }
}

export function raporTabClass(active: boolean) {
  return `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`
}
