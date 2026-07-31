import { api } from './api'
import type { FaaliyetKayit } from '@/types/faaliyetKayit'

export const faaliyetKayitlariApi = {
  list: (params?: { sube_id?: number; faaliyet_id?: number }) => {
    const qs = new URLSearchParams()
    if (params?.sube_id) qs.set('sube_id', String(params.sube_id))
    if (params?.faaliyet_id) qs.set('faaliyet_id', String(params.faaliyet_id))
    const query = qs.toString()
    return api.get<FaaliyetKayit[]>(`/faaliyet-kayitlari${query ? `?${query}` : ''}`)
  },

  create: (data: { faaliyet_id: number; tarih?: string | null; deger: string; aciklama?: string | null }) =>
    api.post<FaaliyetKayit>('/faaliyet-kayitlari', data),

  update: (id: number, data: Partial<{ tarih: string | null; deger: string; aciklama: string | null }>) =>
    api.patch<FaaliyetKayit>(`/faaliyet-kayitlari/${id}`, data),

  destroy: (id: number) => api.delete<void>(`/faaliyet-kayitlari/${id}`),
}
