import { api } from './api'
import type { User, Role } from '@/types/auth'
import type { Birim } from '@/types/birim'
import type { Sube } from '@/types/sube'
import { roleLabels } from '@/utils/constants'

export interface ApiUser {
  id: number
  name: string
  email: string
  role: Role
  birim_id: number | null
  sube_id: number | null
  birim?: Birim
  sube?: Sube
}

export interface UserCreateDto {
  name: string
  email: string
  password?: string
  role: Role
  birim_id?: number | null
  sube_id?: number | null
}

const mapApiUser = (u: ApiUser): User => {
  const initials = u.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: '', // do not expose password from API
    role: u.role,
    roleLabel: roleLabels[u.role] || u.role,
    birim: u.birim?.name,
    sube: u.sube?.name,
    initials,
    birim_id: u.birim_id,
    sube_id: u.sube_id,
  }
}

export const kullanicilarApi = {
  list: async (search?: string) => {
    let url = '/users'
    if (search) {
      url += `?search=${encodeURIComponent(search)}`
    }
    const data = await api.get<ApiUser[]>(url)
    return data.map(mapApiUser)
  },

  create: async (data: UserCreateDto) => {
    const res = await api.post<ApiUser>('/users', data)
    return mapApiUser(res)
  },

  update: async (id: number, data: Partial<UserCreateDto>) => {
    const res = await api.put<ApiUser>(`/users/${id}`, data)
    return mapApiUser(res)
  },

  delete: (id: number) => api.delete<void>(`/users/${id}`),
}
