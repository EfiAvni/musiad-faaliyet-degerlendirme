import { api } from './api'
import type { Birim } from '@/types/birim'

export const birimlerApi = {
  list: () => api.get<Birim[]>('/birimler'),

  create: (data: { name: string; status?: string; created_year?: number | null }) =>
    api.post<Birim>('/birimler', data),

  update: (id: number, data: Partial<{ name: string; status: string; created_year: number | null }>) =>
    api.patch<Birim>(`/birimler/${id}`, data),

  destroy: (id: number) => api.delete<void>(`/birimler/${id}`),
}
