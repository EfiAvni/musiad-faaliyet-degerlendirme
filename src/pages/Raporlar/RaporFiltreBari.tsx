import { RotateCcw } from 'lucide-react'
import type { RaporFiltre, RaporAyi } from '@/types/rapor'
import type { Sube } from '@/types/sube'
import { KATEGORI_ETIKET, KRITER_TURU_ETIKET, SECILEBILIR_KATEGORILER } from '@/types/faaliyet'
import type { KriterTuru } from '@/types/faaliyet'
import { inputCls } from '@/utils/constants'
import { CokluSecim } from '@/components/common/CokluSecim'

const KRITER_TURLERI: KriterTuru[] = ['sayi', 'evet_hayir', 'oran', 'kademeli', 'manuel']

/** Kriter türü etiketleri açıklama içeriyor; filtrede yalnızca adı yeter. */
const turAdi = (t: KriterTuru) => KRITER_TURU_ETIKET[t].split('—')[0].trim()

export function RaporFiltreBari({ aylar, subeler, filtre, onChange }: {
  aylar: RaporAyi[]
  subeler: Sube[]
  filtre: RaporFiltre
  onChange: (yeni: RaporFiltre) => void
}) {
  // Müşteri "Mart-Temmuz" gibi bir aralık istiyor; iki uçlu seçim arka planda
  // aradaki bütün ayların id listesine çevrilir.
  const seciliAylar = filtre.ayIds
  const ilk = seciliAylar.length ? aylar.find(a => a.id === seciliAylar[0]) : null
  const son = seciliAylar.length ? aylar.find(a => a.id === seciliAylar[seciliAylar.length - 1]) : null

  const aralikKur = (baslangicSira: number, bitisSira: number) => {
    const [alt, ust] = baslangicSira <= bitisSira
      ? [baslangicSira, bitisSira]
      : [bitisSira, baslangicSira]

    onChange({
      ...filtre,
      ayIds: aylar.filter(a => a.sira >= alt && a.sira <= ust).map(a => a.id),
    })
  }

  const baslangicDegisti = (sira: number) => aralikKur(sira, son?.sira ?? aylar[aylar.length - 1].sira)
  const bitisDegisti = (sira: number) => aralikKur(ilk?.sira ?? aylar[0].sira, sira)

  const filtreVarMi =
    filtre.ayIds.length > 0 ||
    filtre.subeIds.length > 0 ||
    filtre.kategoriler.length > 0 ||
    filtre.kriterTurleri.length > 0

  const temizle = () => onChange({ ayIds: [], subeIds: [], kategoriler: [], kriterTurleri: [] })

  return (
    <div className="mb-4 p-4 bg-white border border-gray-100 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Filtreler</h3>
        {filtreVarMi && (
          <button
            onClick={temizle}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={12} /> Filtreleri temizle
          </button>
        )}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Başlangıç ayı</label>
          <select
            className={inputCls}
            value={ilk?.sira ?? ''}
            onChange={e => (e.target.value === '' ? temizleAylar() : baslangicDegisti(Number(e.target.value)))}
          >
            <option value="">Dönem başı</option>
            {aylar.map(a => <option key={a.id} value={a.sira}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Bitiş ayı</label>
          <select
            className={inputCls}
            value={son?.sira ?? ''}
            onChange={e => (e.target.value === '' ? temizleAylar() : bitisDegisti(Number(e.target.value)))}
          >
            <option value="">Dönem sonu</option>
            {aylar.map(a => <option key={a.id} value={a.sira}>{a.name}</option>)}
          </select>
        </div>

        <CokluSecim
          etiket="Şube"
          hepsiEtiketi="Tüm şubeler"
          secenekler={subeler.map(s => ({ deger: String(s.id), etiket: s.name }))}
          secili={filtre.subeIds.map(String)}
          onChange={v => onChange({ ...filtre, subeIds: v.map(Number) })}
        />

        <CokluSecim
          etiket="Kriter başlığı"
          hepsiEtiketi="Tüm başlıklar"
          secenekler={SECILEBILIR_KATEGORILER.map(k => ({ deger: k, etiket: KATEGORI_ETIKET[k] }))}
          secili={filtre.kategoriler}
          onChange={v => onChange({ ...filtre, kategoriler: v })}
        />

        <CokluSecim
          etiket="Puanlama türü"
          hepsiEtiketi="Tüm türler"
          secenekler={KRITER_TURLERI.map(t => ({ deger: t, etiket: turAdi(t) }))}
          secili={filtre.kriterTurleri}
          onChange={v => onChange({ ...filtre, kriterTurleri: v })}
        />
      </div>

      {seciliAylar.length > 0 && ilk && son && (
        <p className="mt-3 text-xs text-gray-500">
          <strong className="text-gray-700">{ilk.name} – {son.name}</strong> aralığı ({seciliAylar.length} ay).
          Hedefler bu ay sayısına göre orantılanır; dönemin tamamı için konmuş hedef payda tutulmaz.
        </p>
      )}
    </div>
  )

  function temizleAylar() {
    onChange({ ...filtre, ayIds: [] })
  }
}
