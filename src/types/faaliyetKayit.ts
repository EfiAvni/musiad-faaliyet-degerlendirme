export type FaaliyetKayit = {
  id: number
  faaliyet_id: number
  sube_id: number
  donem_ay_id: number
  tarih: string | null
  deger: string
  aciklama: string | null
  created_by: number | null
  created_at: string
  updated_at: string
  faaliyet?: { id: number; title: string; detay: string | null; puan: number; hedef: number; donem_id: number; max_puan: number } | null
  donem_ay?: { id: number; name: string; sira: number; start_date: string; end_date: string; acik_override: boolean | null; acik: boolean } | null
  sube?: { id: number; name: string } | null
}
