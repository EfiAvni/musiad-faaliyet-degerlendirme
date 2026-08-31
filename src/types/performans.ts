import type { GonderimDurum } from './gonderim'
import type { KriterKategori, KriterTuru } from './faaliyet'
import type { RaporKategori } from './rapor'

/**
 * Doküman bölüm 4 ve 13: şubenin kendi performansı. Merkezin rapor tiplerinden
 * ayrı duruyor çünkü içerikleri de ayrı: burada başka şubelerin puanı veya
 * sıralama yok, yalnızca oturumdaki kullanıcının şubesi var.
 */
export type PerformansFaaliyet = {
  faaliyet_id: number
  title: string
  kriter_turu: KriterTuru
  kategori: KriterKategori
  kategori_adi: string
  hedef: number
  kayit_sayisi: number
  puan: number
  max_puan: number
}

export type PerformansAyDurumu = {
  ay_id: number
  ay: string
  sira: number
  durum: GonderimDurum
}

export type DonemPerformansi = {
  donem: {
    id: number
    name: string
    birim_adi: string | null
    start_date: string
    end_date: string
    status: 'pending' | 'active' | 'completed'
  } | null
  genel: {
    toplam_puan: number
    max_puan: number
    basari_orani: number
    kayit_sayisi: number
  } | null
  faaliyetler: PerformansFaaliyet[]
  kategori_kirilimi: RaporKategori[]
  ay_durumlari?: PerformansAyDurumu[]
}

export type YillikDonemSatiri = {
  donem_id: number
  donem_adi: string
  birim_adi: string | null
  puan: number
  max_puan: number
  oran: number
  tamamlandi: boolean
}

export type YillikPerformansim = {
  yil: number
  sube_adi: string
  donem_puanlari: YillikDonemSatiri[]
  kategori_kirilimi: RaporKategori[]
  genel: {
    donem_sayisi: number
    tamamlanan_donem: number
    toplam_puan: number
    max_puan: number
    ortalama_puan: number
    basari_orani: number
  }
}
