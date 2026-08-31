import { api, downloadFile } from './api'
import type { DonemRaporu, YillikRapor } from '@/types/rapor'

export const raporlarApi = {
  donemRaporu: (donemId: number) => api.get<DonemRaporu>(`/raporlar/${donemId}`),

  /** Doküman bölüm 9: dönem puanları yıl içinde birikerek yıllık performansı oluşturur. */
  yillikRapor: (yil: number) => api.get<YillikRapor>(`/raporlar/yillik?yil=${yil}`),

  indirPdf: async (donemId: number, dosyaAdi: string) => {
    const blob = await api.getBlob(`/raporlar/${donemId}/pdf`)
    downloadFile(blob, dosyaAdi)
  },
}
