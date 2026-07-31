import { api } from './api'
import type { Sube, ImportItem, ImportResult, PuanOzeti } from '@/types/sube'

export const subelerApi = {
  list: () => api.get<Sube[]>('/subeler'),

  create: (data: { name: string; uye_sayisi?: number; birim_id?: number | null; status?: string }) =>
    api.post<Sube>('/subeler', data),

  update: (id: number, data: Partial<{ name: string; uye_sayisi: number; birim_id: number | null; status: string }>) =>
    api.patch<Sube>(`/subeler/${id}`, data),

  destroy: (id: number) => api.delete<void>(`/subeler/${id}`),

  import: (items: ImportItem[]) =>
    api.post<ImportResult>('/subeler/import', { subeler: items }),

  puanOzeti: (id: number, donemId?: number) =>
    api.get<PuanOzeti>(`/subeler/${id}/puan-ozeti${donemId ? `?donem_id=${donemId}` : ''}`),
}
