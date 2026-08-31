import { api } from './api'
import type { Gonderim } from '@/types/gonderim'

export const gonderimlerApi = {
  /** Şube kendi gönderimlerini, merkez kendi biriminin gönderimlerini görür. */
  list: (filtre?: { durum?: string; donem_id?: number; sube_id?: number }) => {
    const p = new URLSearchParams()
    if (filtre?.durum) p.set('durum', filtre.durum)
    if (filtre?.donem_id) p.set('donem_id', String(filtre.donem_id))
    if (filtre?.sube_id) p.set('sube_id', String(filtre.sube_id))
    const qs = p.toString()
    return api.get<Gonderim[]>(`/gonderimler${qs ? `?${qs}` : ''}`)
  },

  /** Şube: ayı merkeze gönder (düzeltme sonrası tekrar göndermek için de aynı uç). */
  gonder: (ayId: number) => api.post<Gonderim>(`/donem-aylar/${ayId}/gonder`),

  onayla: (gonderimId: number, merkezNotu?: string) =>
    api.post<Gonderim>(`/gonderimler/${gonderimId}/onayla`, merkezNotu ? { merkez_notu: merkezNotu } : {}),

  duzeltmeIste: (gonderimId: number, merkezNotu: string) =>
    api.post<Gonderim>(`/gonderimler/${gonderimId}/duzeltme-iste`, { merkez_notu: merkezNotu }),

  /** Yalnızca kriter türü "manuel" olan faaliyetler için. */
  puanla: (gonderimId: number, faaliyetId: number, puan: number, not?: string) =>
    api.post<{ id: number; faaliyet_id: number; puan: number; not: string | null }>(
      `/gonderimler/${gonderimId}/puanla`,
      { faaliyet_id: faaliyetId, puan, not: not || null },
    ),
}
