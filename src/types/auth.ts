export type AuthUser = {
  id: number
  name: string
  email: string
  role: 'superadmin' | 'birim_yoneticisi' | 'sube_yoneticisi'
  birim_id: number | null
  sube_id: number | null
}

export type Role = 'superadmin' | 'birim_yoneticisi' | 'sube_yoneticisi'

export type User = {
  id: number
  name: string
  email: string
  password: string
  role: Role
  roleLabel: string
  birim?: string
  sube?: string
  initials: string
  birim_id?: number | null
  sube_id?: number | null
}
