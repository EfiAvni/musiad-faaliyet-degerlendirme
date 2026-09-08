import { api } from './api'
import type { BildirimYaniti } from '@/types/bildirim'

export const bildirimlerApi = {
  list: () => api.get<BildirimYaniti>('/bildirimler'),

  okundu: (id: string) => api.post<{ okunmamis: number }>(`/bildirimler/${id}/okundu`),

  tumunuOkundu: () => api.post<{ okunmamis: number }>('/bildirimler/okundu'),
}
