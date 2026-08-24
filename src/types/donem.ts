export type DonemAy = {
  id: number
  donem_id: number
  sira: number
  name: string
  start_date: string
  end_date: string
  acik_override: boolean | null
  acik: boolean
}

export type DonemStatus = 'pending' | 'active' | 'completed'

export type PeriyotTipi = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom'

export type Donem = {
  id: number
  name: string
  /** Dönem tek bir birime aittir; birimler arası ayrışma burada yapılır. */
  birim_id: number
  birim?: { id: number; name: string } | null
  start_date: string
  end_date: string
  status: DonemStatus
  tum_subeler: boolean
  created_at: string
  updated_at: string
  periyot_tipi: PeriyotTipi
  aylar_count?: number
  faaliyetler_count?: number
  aylar?: DonemAy[]
  subeler?: { id: number; name: string }[]
}
