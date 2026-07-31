import { api, downloadFile } from './api'
import type { DonemRaporu } from '@/types/rapor'

export const raporlarApi = {
  donemRaporu: (donemId: number) => api.get<DonemRaporu>(`/raporlar/${donemId}`),

  indirPdf: async (donemId: number, dosyaAdi: string) => {
    const blob = await api.getBlob(`/raporlar/${donemId}/pdf`)
    downloadFile(blob, dosyaAdi)
  },
}
