export type FaaliyetDurum = 'active' | 'completed' | 'passive'

export type Faaliyet = {
  id: number
  title: string
  detay: string | null
  puan: number
  hedef: number
  max_puan: number
  aciklama: string | null
  tarih_gerekli: boolean
  donem_id: number
  durum: FaaliyetDurum
  created_at: string
  updated_at: string
  donem?: { id: number; name: string; status: string } | null
}

export type FaaliyetPayload = {
  title: string
  detay?: string | null
  puan?: number
  hedef?: number
  aciklama?: string | null
  tarih_gerekli?: boolean
  donem_id: number
  durum?: string
}
