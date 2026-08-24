// Şubeler tüm birimler için ortaktır - birim bilgisi şubede değil dönemde tutulur.
export type Sube = {
  id: number
  name: string
  yonetici_id: number | null
  uye_sayisi: number
  status: 'active' | 'passive'
  created_at: string
  updated_at: string
}

export type ImportItem = { name: string; uye_sayisi?: number }
export type ImportResult = { created: number; skipped: string[]; message: string }

export type PuanOzeti = {
  donem_id: number | null
  toplam_puan: number
  detaylar: {
    faaliyet_id: number
    title: string
    kayit_sayisi: number
    puan: number
    hedef: number
    max_puan: number
    puan_katkisi: number
  }[]
}
