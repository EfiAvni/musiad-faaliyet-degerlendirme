export type Role = 'superadmin' | 'birim_yoneticisi' | 'sube_yoneticisi'

/**
 * /auth/login ve /auth/me yanıtı. Arayüzün ihtiyaç duyduğu görüntü alanları
 * (birim/şube adı, baş harfler) backend'de üretilir - istemci tarafında sabit
 * bir kullanıcı listesinden türetilmez.
 */
export type AuthUser = {
  id: number
  name: string
  email: string
  role: Role
  birim_id: number | null
  sube_id: number | null
  birim_adi: string | null
  sube_adi: string | null
  initials: string
}

/** Oturumdaki kullanıcı: API yanıtı + arayüzde gösterilen rol etiketi. */
export type User = AuthUser & {
  roleLabel: string
}
