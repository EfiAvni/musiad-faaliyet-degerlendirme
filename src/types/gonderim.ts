export type GonderimDurum = 'taslak' | 'gonderildi' | 'duzeltme_bekliyor' | 'onaylandi'

export type Gonderim = {
  id: number
  donem_ay_id: number
  sube_id: number
  durum: Exclude<GonderimDurum, 'taslak'>
  gonderildi_at: string | null
  degerlendirildi_at: string | null
  merkez_notu: string | null
  sube?: { id: number; name: string } | null
  donem_ay?: {
    id: number
    name: string
    sira: number
    donem_id: number
  } | null
  gonderen?: { id: number; name: string } | null
  degerlendiren?: { id: number; name: string } | null
  /** Merkezin elle puanladığı faaliyetler; yalnızca kriter türü "manuel" olanlar. */
  degerlendirmeler?: { id: number; faaliyet_id: number; puan: number; not: string | null }[]
}

/** Gönderim kaydı olmayan ay taslaktır - backend o ay için satır tutmaz. */
export const GONDERIM_DURUM_ETIKET: Record<GonderimDurum, string> = {
  taslak: 'Taslak',
  gonderildi: 'İncelemede',
  duzeltme_bekliyor: 'Düzeltme Bekleniyor',
  onaylandi: 'Onaylandı',
}

export const GONDERIM_DURUM_RENK: Record<GonderimDurum, { bg: string; text: string }> = {
  taslak:            { bg: '#f9fafb', text: '#6b7280' },
  gonderildi:        { bg: '#eff6ff', text: '#1e40af' },
  duzeltme_bekliyor: { bg: '#fffbeb', text: '#92400e' },
  onaylandi:         { bg: '#e9f3ed', text: '#2f6b4f' },
}
