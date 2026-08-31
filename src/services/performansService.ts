import { api } from './api'
import type { DonemPerformansi, YillikPerformansim } from '@/types/performans'

/**
 * Şubenin kendi performansı. Şube id'si gönderilmiyor - backend oturumdan
 * alıyor, böylece istemci başka bir şubeyi soramıyor (doküman bölüm 4).
 */
export const performansimApi = {
  donem: (donemId?: number) =>
    api.get<DonemPerformansi>(`/performansim${donemId ? `?donem_id=${donemId}` : ''}`),

  yillik: (yil: number) => api.get<YillikPerformansim>(`/performansim/yillik?yil=${yil}`),

  yillar: () => api.get<number[]>('/performansim/yillar'),
}
