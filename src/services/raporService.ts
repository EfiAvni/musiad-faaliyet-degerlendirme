import { api, downloadFile } from './api'
import type { DonemRaporu, RaporFiltre, YillikRapor } from '@/types/rapor'

/** Boş liste "hepsi" demektir; sorguya hiç eklenmez. */
function filtreSorgusu(filtre?: RaporFiltre): string {
  if (!filtre) return ''

  const qs = new URLSearchParams()
  if (filtre.ayIds.length) qs.set('ay_ids', filtre.ayIds.join(','))
  if (filtre.subeIds.length) qs.set('sube_ids', filtre.subeIds.join(','))
  if (filtre.kategoriler.length) qs.set('kategoriler', filtre.kategoriler.join(','))
  if (filtre.kriterTurleri.length) qs.set('kriter_turleri', filtre.kriterTurleri.join(','))

  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const raporlarApi = {
  donemRaporu: (donemId: number, filtre?: RaporFiltre) =>
    api.get<DonemRaporu>(`/raporlar/${donemId}${filtreSorgusu(filtre)}`),

  /** Doküman bölüm 9: dönem puanları yıl içinde birikerek yıllık performansı oluşturur. */
  yillikRapor: (yil: number) => api.get<YillikRapor>(`/raporlar/yillik?yil=${yil}`),

  // PDF ekrandakiyle aynı filtreyi alır; kullanıcı süzüp indirdiğinde eline
  // dönemin tamamı geçmemeli.
  indirPdf: async (donemId: number, dosyaAdi: string, filtre?: RaporFiltre) => {
    const blob = await api.getBlob(`/raporlar/${donemId}/pdf${filtreSorgusu(filtre)}`)
    downloadFile(blob, dosyaAdi)
  },
}
