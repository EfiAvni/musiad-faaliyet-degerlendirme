import { api } from './api'
import type { AuthUser, Role, User } from '@/types/auth'
import { toDisplayUser } from '@/utils/helpers'

export type UserCreateDto = {
  name: string
  email: string
  password?: string
  role: Role
  birim_id?: number | null
  sube_id?: number | null
}

// Backend tüm kullanıcı uçlarında aynı gösterimi döndürür (UserResource), bu
// yüzden istemcide yapılacak tek iş rol etiketini eklemek.
const toUser = (u: AuthUser): User => toDisplayUser(u)

export const kullanicilarApi = {
  list: async (search?: string) => {
    const url = search ? `/users?search=${encodeURIComponent(search)}` : '/users'
    const data = await api.get<AuthUser[]>(url)
    return data.map(toUser)
  },

  create: async (data: UserCreateDto) => toUser(await api.post<AuthUser>('/users', data)),

  update: async (id: number, data: Partial<UserCreateDto>) =>
    toUser(await api.put<AuthUser>(`/users/${id}`, data)),

  delete: (id: number) => api.delete<void>(`/users/${id}`),
}
