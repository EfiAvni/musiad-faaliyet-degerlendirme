export type FaaliyetDurum = 'active' | 'completed' | 'passive'

/** Doküman bölüm 6: her kriter kendi mantığına göre puanlanır. */
export type KriterTuru = 'sayi' | 'evet_hayir' | 'oran' | 'kademeli' | 'manuel'

export type Kademe = { esik: number; puan: number }

export const KRITER_TURU_ETIKET: Record<KriterTuru, string> = {
  sayi:       'Sayı — kaç kez yapıldı',
  evet_hayir: 'Evet / Hayır — yapıldı mı',
  oran:       'Oran — üye sayısına göre',
  kademeli:   'Kademeli — seviyeye göre puan',
  manuel:     'Manuel — merkez puan verir',
}

export const KRITER_TURU_ACIKLAMA: Record<KriterTuru, string> = {
  sayi:       'Her kayıt puan getirir, hedefe ulaşınca tavanlanır. Puan × Hedef kadar puan alınabilir.',
  evet_hayir: 'Şube bu faaliyeti en az bir kez yaptıysa tam puan alır; fazlası ek puan getirmez.',
  oran:       'Şube büyüklüğüne göre normalize edilir. Hedef, üyelerin yüzde kaçına ulaşılacağını belirtir.',
  kademeli:   'Belirlediğiniz eşikleri geçtikçe puan artar. Şube, eşiğini geçtiği en yüksek kademenin puanını alır.',
  manuel:     'Otomatik sayılamayan kriterler için. Merkez gönderimi incelerken puanı kendisi verir.',
}

export type Faaliyet = {
  id: number
  title: string
  detay: string | null
  puan: number
  hedef: number
  max_puan: number
  aciklama: string | null
  tarih_gerekli: boolean
  donem_id: number
  durum: FaaliyetDurum
  kriter_turu: KriterTuru
  kademeler: Kademe[] | null
  created_at: string
  updated_at: string
  donem?: { id: number; name: string; status: string } | null
}

export type FaaliyetPayload = {
  title: string
  detay?: string | null
  puan?: number
  hedef?: number
  aciklama?: string | null
  tarih_gerekli?: boolean
  donem_id: number
  durum?: string
  kriter_turu?: KriterTuru
  kademeler?: Kademe[] | null
}
