export type Birim = {
  id: number
  name: string
  yonetici_id: number | null
  status: 'active' | 'passive'
  created_year: number | null
  subeler_count: number
  created_at: string
  updated_at: string
}
