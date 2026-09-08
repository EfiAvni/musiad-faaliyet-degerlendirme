import type { PeriyotTipi } from './donem'
import type { KriterKategori } from './faaliyet'

export type RaporTab = 'genel' | 'sube' | 'faaliyet' | 'matris' | 'kategori'

export type RaporGenel = {
  toplam_sube: number
  toplam_faaliyet: number
  toplam_hedef: number
  toplam_kayit: number
  ortalama_tamamlanma: number
  en_iyi_sube_adi: string | null
  en_iyi_sube_orani: number | null
  /** Oran tipi kriter varken üye sayısı girilmemiş şubeler — o kriterlerde puan üretilemez. */
  uye_sayisi_eksik: { sube_id: number; sube_adi: string }[]
}

export type RaporSube = {
  sube_id: number
  sube_adi: string
  toplam_puan: number
  max_puan: number
  tamamlanma_orani: number
  kayit_sayisi: number
}

export type RaporFaaliyet = {
  faaliyet_id: number
  title: string
  puan: number
  /** Ay aralığı seçiliyse orantılanmış hedef. */
  hedef: number
  /** Dönemin tamamı için konmuş hedef — orantılamanın neye göre yapıldığı görünsün diye. */
  donem_hedefi: number
  kriter_turu: string
  kategori: string
  max_puan: number
  toplam_kayit: number
  toplam_puan: number
  /** Bu kriterden puan almış şube sayısı — manuel kriterde kayıt olmadan da puan alınabilir. */
  katilan_sube_sayisi: number
  doluluk_orani: number
}

export type RaporAy = {
  ay_id: number
  ay: string
  sira: number
  kayit_sayisi: number
  /** Ay aralığı filtresine dahil mi — trend grafiği aralık dışını soluk gösterir. */
  secili: boolean
}

/** Dönemin ayları; ay aralığı seçicisinin kaynağı. */
export type RaporAyi = {
  id: number
  name: string
  sira: number
}

/** Arayüzdeki filtre durumu. Boş dizi "hepsi" demektir. */
export type RaporFiltre = {
  ayIds: number[]
  subeIds: number[]
  kategoriler: string[]
  kriterTurleri: string[]
}

/** Sunucunun uyguladığı filtre — arayüzün gönderdiğinden farklı olabilir (geçersiz değerler süzülür). */
export type UygulananFiltre = {
  ay_ids: number[] | null
  sube_ids: number[] | null
  kategoriler: string[] | null
  kriter_turleri: string[] | null
  donem_orani: number
  hedef_orantili: boolean
}

export type RaporMatrisHucre = {
  sube_id: number
  faaliyet_id: number
  adet: number
  puan_katkisi: number
  doluluk_orani: number
}

export type DonemRaporu = {
  donem: {
    id: number
    name: string
    start_date: string
    end_date: string
    status: 'pending' | 'active' | 'completed'
    tum_subeler: boolean
    subeler: { id: number; name: string }[]
    periyot_tipi: PeriyotTipi
    aylar: RaporAyi[]
  }
  filtre: UygulananFiltre
  genel: RaporGenel
  sube_bazli: RaporSube[]
  faaliyet_bazli: RaporFaaliyet[]
  aylik_trend: RaporAy[]
  sube_faaliyet_matrisi: RaporMatrisHucre[]
  kategori_bazli: RaporKategori[]
}

/** Doküman bölüm 7-8: hangi konuda başarılı, hangi konuda eksik. */
export type RaporKategori = {
  kategori: KriterKategori
  etiket: string
  puan: number
  max_puan: number
  oran: number
}

export type YillikDonemPuani = {
  donem_id: number
  donem_adi: string
  puan: number
  max_puan: number
  oran: number
  tamamlandi: boolean
}

export type YillikSube = {
  sube_id: number
  sube_adi: string
  donem_puanlari: YillikDonemPuani[]
  toplam_puan: number
  max_puan: number
  ortalama_puan: number
  basari_orani: number
  katildigi_donem: number
  tamamlanan_donem: number
  kategori_kirilimi: RaporKategori[]
}

export type YillikRapor = {
  yil: number
  donemler: {
    id: number
    name: string
    birim_adi: string | null
    start_date: string
    end_date: string
    status: 'pending' | 'active' | 'completed'
  }[]
  sube_bazli: YillikSube[]
  kategori_bazli: RaporKategori[]
  genel: {
    donem_sayisi: number
    tamamlanan_donem: number
    sube_sayisi: number
    ortalama_basari: number
    en_iyi_sube_adi: string | null
    en_iyi_sube_puani: number | null
    en_dusuk_sube_adi: string | null
    en_dusuk_sube_puani: number | null
  }
}
