import type { Page } from './navigation'

export type BildirimTuru =
  | 'ay_gonderildi'
  | 'onaylandi'
  | 'duzeltme_istendi'
  | 'donem_acildi'

export type Bildirim = {
  id: string
  tur: BildirimTuru | null
  baslik: string
  mesaj: string
  /** Bildirime tıklayınca açılacak sayfa; tanınmayan değer yok sayılır. */
  sayfa: Page | null
  okundu: boolean
  created_at: string
}

export type BildirimYaniti = {
  okunmamis: number
  liste: Bildirim[]
}

/** Çan listesindeki renk şeridi — durum rengi, marka rengi değil. */
export const BILDIRIM_RENK: Record<BildirimTuru, string> = {
  ay_gonderildi:    '#1E40AF',
  onaylandi:        '#2F6B4F',
  duzeltme_istendi: '#92400E',
  donem_acildi:     '#B99C1A',
}
