import { useState, useEffect, useMemo } from 'react'
import { CalendarRange, Trophy, ChevronDown, ChevronRight } from 'lucide-react'
import { raporlarApi } from '@/services/raporService'
import type { YillikRapor, YillikSube } from '@/types/rapor'
import { inputCls, RAPOR_RENK } from '@/utils/constants'
import { formatPercent } from '@/utils/formatters'
import { usePagination } from '@/hooks/usePagination'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { FormField } from '@/components/common/FormField'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { SearchBar } from '@/components/common/SearchBar'
import { Pagination } from '@/components/common/Pagination'
import { RaporKategoriKirilimi } from './RaporKategoriKirilimi'

const SAYFA_BOYUTU = 25

/** Dönem başlangıç yılı seçenekleri: içinde bulunduğumuz yıl ve geriye doğru 4 yıl. */
function yilSecenekleri(): number[] {
  const buYil = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => buYil - i)
}

export function RaporYillikGorunumu() {
  const [yil, setYil] = useState(() => new Date().getFullYear())
  const [rapor, setRapor] = useState<YillikRapor | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [acikSube, setAcikSube] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    raporlarApi.yillikRapor(yil)
      .then(data => { setRapor(data); setApiError('') })
      .catch(() => setApiError('Yıllık rapor yüklenemedi. Backend bağlantısını kontrol edin.'))
      .finally(() => setLoading(false))
  }, [yil])

  const secenekler = useMemo(yilSecenekleri, [])

  return (
    <div>
      <div className="mb-6 w-40">
        <FormField label="Yıl">
          <select className={inputCls} value={yil} onChange={e => setYil(Number(e.target.value))}>
            {secenekler.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </FormField>
      </div>

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      {loading ? (
        <Loading />
      ) : !rapor || rapor.genel.donem_sayisi === 0 ? (
        <EmptyState icon={CalendarRange} title={`${yil} yılında dönem bulunmuyor`}
          subtitle="Yıllık performans, o yıl içinde başlayan dönemlerin puanları toplanarak oluşur." />
      ) : (
        <YillikIcerik rapor={rapor} acikSube={acikSube} setAcikSube={setAcikSube} />
      )}
    </div>
  )
}

function YillikIcerik({ rapor, acikSube, setAcikSube }: {
  rapor: YillikRapor
  acikSube: number | null
  setAcikSube: (v: number | null) => void
}) {
  const { genel, donemler, sube_bazli, kategori_bazli } = rapor
  const [arama, setArama] = useState('')

  const filtreli = useMemo(
    () => sube_bazli.filter(s => s.sube_adi.toLowerCase().includes(arama.toLowerCase().trim())),
    [sube_bazli, arama],
  )

  // Sıralama yıl geneline göre; arama sonucundaki satır da gerçek sırasını taşımalı.
  const siraHaritasi = useMemo(
    () => new Map(sube_bazli.map((s, i) => [s.sube_id, i])),
    [sube_bazli],
  )

  // 198 şubelik listede tamamı tek seferde çizilirse tablo kullanılmaz hale
  // geliyor; sıralama sunucudan geldiği için sayfalama sırayı bozmaz.
  const { page, totalPages, pageItems, nextPage, prevPage, setPage } = usePagination(filtreli, SAYFA_BOYUTU)

  useEffect(() => { setPage(1) }, [arama])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Dönem', value: `${genel.tamamlanan_donem}/${genel.donem_sayisi}`, alt: 'tamamlanan', color: RAPOR_RENK },
          { label: 'Şube', value: genel.sube_sayisi, alt: 'değerlendirmeye giren', color: '#2563eb' },
          { label: 'Ortalama Başarı', value: `%${formatPercent(genel.ortalama_basari)}`, alt: 'yıl geneli', color: '#059669' },
          { label: 'En Yüksek Puan', value: genel.en_iyi_sube_puani ?? 0, alt: genel.en_iyi_sube_adi ?? '—', color: '#f59e0b' },
        ].map((s, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{s.value}</p>
              <p className="text-xs text-gray-500 truncate" title={s.alt}>{s.label} · {s.alt}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Doküman bölüm 9: Dönem | Puan tablosu — satırlar şube, sütunlar dönem. */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              Şube Bazlı Yıllık Performans
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Şube adına tıklayarak kriter kırılımını açabilirsiniz</p>
          </div>
          <SearchBar placeholder="Şube ara..." value={arama} onChange={setArama} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-medium text-gray-500 text-xs py-2 pr-3 sticky left-0 bg-white">Şube</th>
                {donemler.map(d => (
                  <th key={d.id} className="text-center font-medium text-gray-500 text-xs py-2 px-2 whitespace-nowrap" title={d.name}>
                    {d.name}
                    {d.status !== 'completed' && <span className="text-gray-300"> •</span>}
                  </th>
                ))}
                <th className="text-right font-medium text-gray-500 text-xs py-2 pl-3 whitespace-nowrap">Toplam</th>
                <th className="text-right font-medium text-gray-500 text-xs py-2 pl-3 whitespace-nowrap">Ortalama</th>
                <th className="text-right font-medium text-gray-500 text-xs py-2 pl-3 whitespace-nowrap">Başarı</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(s => (
                <SubeSatiri key={s.sube_id} sube={s} sira={siraHaritasi.get(s.sube_id) ?? 0} donemIds={donemler.map(d => d.id)}
                  acik={acikSube === s.sube_id}
                  onToggle={() => setAcikSube(acikSube === s.sube_id ? null : s.sube_id)} />
              ))}
            </tbody>
          </table>
          {filtreli.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Aramanıza uyan şube bulunamadı.</p>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} toplam={filtreli.length} pageSize={SAYFA_BOYUTU}
          onPrev={prevPage} onNext={nextPage} onPage={setPage} birim="şube" />

        <p className="text-xs text-gray-400 mt-3">
          Boş hücre, şubenin o dönemin kapsamında olmadığını gösterir; o dönem ortalamasına da katılmaz.
          Nokta işareti henüz tamamlanmamış dönemleri belirtir.
        </p>
      </Card>

      <Card className="p-5">
        <RaporKategoriKirilimi kirilim={kategori_bazli} baslik="Kriter Başlıklarına Göre Yıl Geneli" />
      </Card>
    </div>
  )
}

function SubeSatiri({ sube, sira, donemIds, acik, onToggle }: {
  sube: YillikSube
  sira: number
  donemIds: number[]
  acik: boolean
  onToggle: () => void
}) {
  const puanHaritasi = new Map(sube.donem_puanlari.map(d => [d.donem_id, d]))

  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
        <td className="py-2.5 pr-3 sticky left-0 bg-white">
          <button onClick={onToggle} className="flex items-center gap-1.5 text-left group">
            {acik ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
            {sira === 0 && <Trophy size={12} style={{ color: RAPOR_RENK }} />}
            <span className="text-gray-800 group-hover:text-gray-900 font-medium whitespace-nowrap">{sube.sube_adi}</span>
          </button>
        </td>
        {donemIds.map(id => {
          const d = puanHaritasi.get(id)
          return (
            <td key={id} className="text-center py-2.5 px-2 text-gray-600">
              {d ? d.puan : <span className="text-gray-300">—</span>}
            </td>
          )
        })}
        <td className="text-right py-2.5 pl-3 font-semibold text-gray-900">{sube.toplam_puan}</td>
        <td className="text-right py-2.5 pl-3 text-gray-600">{sube.ortalama_puan}</td>
        <td className="text-right py-2.5 pl-3">
          <span className="font-medium" style={{ color: RAPOR_RENK }}>%{formatPercent(sube.basari_orani)}</span>
        </td>
      </tr>
      {acik && (
        <tr className="border-b border-gray-50">
          <td colSpan={donemIds.length + 4} className="py-4 px-3 bg-gray-50/60">
            <p className="text-xs text-gray-500 mb-3">
              {sube.sube_adi} · {sube.katildigi_donem} dönemde yer aldı, {sube.tamamlanan_donem} tanesi tamamlandı ·
              toplam {sube.toplam_puan}/{sube.max_puan} puan
            </p>
            <RaporKategoriKirilimi kirilim={sube.kategori_kirilimi} />
          </td>
        </tr>
      )}
    </>
  )
}

/** Raporlar sayfasından ayrı da açılabilsin diye başlığıyla birlikte sarmalayan sürüm. */
export function RaporYillikPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Yıllık Performans"
        subtitle="Dönem puanları yıl içinde birikerek şubenin yıllık performansını oluşturur" />
      <RaporYillikGorunumu />
    </div>
  )
}
