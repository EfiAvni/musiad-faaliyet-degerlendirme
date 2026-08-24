import { api } from './api'
import type { Donem, DonemAy } from '@/types/donem'

export const donemlerApi = {
  list: () => api.get<Donem[]>('/donemler'),

  show: (id: number) => api.get<Donem>(`/donemler/${id}`),

  create: (data: { name: string; start_date: string; end_date: string; birim_id?: number; tum_subeler?: boolean; sube_ids?: number[] }) =>
    api.post<Donem>('/donemler', data),

  update: (id: number, data: Partial<{ name: string; start_date: string; end_date: string; tum_subeler: boolean; sube_ids: number[] }>) =>
    api.patch<Donem>(`/donemler/${id}`, data),

  destroy: (id: number) => api.delete<void>(`/donemler/${id}`),

  activate: (id: number) => api.post<Donem>(`/donemler/${id}/activate`),

  complete: (id: number) => api.post<Donem>(`/donemler/${id}/complete`),

  updateAy: (ayId: number, acikOverride: boolean | null) =>
    api.patch<DonemAy>(`/donem-aylar/${ayId}`, { acik_override: acikOverride }),
}
