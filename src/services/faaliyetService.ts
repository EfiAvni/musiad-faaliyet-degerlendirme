import { api } from './api'
import type { Faaliyet, FaaliyetPayload } from '@/types/faaliyet'

export const faaliyetlerApi = {
  list: (donemId?: number) =>
    api.get<Faaliyet[]>(donemId ? `/faaliyetler?donem_id=${donemId}` : '/faaliyetler'),

  create: (data: FaaliyetPayload) =>
    api.post<Faaliyet>('/faaliyetler', data),

  update: (id: number, data: Partial<FaaliyetPayload>) =>
    api.patch<Faaliyet>(`/faaliyetler/${id}`, data),

  destroy: (id: number) => api.delete<void>(`/faaliyetler/${id}`),
}
