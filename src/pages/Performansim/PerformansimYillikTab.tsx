import { CalendarRange } from 'lucide-react'
import type { YillikPerformansim } from '@/types/performans'
import { RAPOR_RENK } from '@/utils/constants'
import { formatOranMetni, formatPercent } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { RaporKategoriKirilimi } from '@/pages/Raporlar/RaporKategoriKirilimi'

/** Doküman bölüm 13: "önceki yıl performansı" - şubenin kendi dönemleri. */
export function PerformansimYillikTab({ veri }: { veri: YillikPerformansim }) {
  const { genel, donem_puanlari } = veri

  if (genel.donem_sayisi === 0) {
    return <EmptyState icon={CalendarRange} title={`${veri.yil} yılında dönem bulunmuyor`}
      subtitle="Şubenizin kapsamına giren bir dönem açıldığında burada görünecek." />
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Puan', value: genel.toplam_puan, alt: `${genel.max_puan} üzerinden`, color: RAPOR_RENK },
          { label: 'Ortalama', value: genel.ortalama_puan, alt: 'dönem başına', color: '#2563eb' },
          { label: 'Tamamlanan', value: `${genel.tamamlanan_donem}/${genel.donem_sayisi}`, alt: 'dönem', color: '#059669' },
          { label: 'Başarı', value: `%${formatOranMetni(genel.basari_orani)}`, alt: 'yıl geneli', color: '#f59e0b' },
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

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
          Dönem Dönem Puanınız
        </h3>

        <div className="space-y-3">
          {donem_puanlari.map(d => {
            const yuzde = formatPercent(d.oran)
            return (
              <div key={d.donem_id}>
                <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                  <span className="text-xs text-gray-600">
                    {d.donem_adi}
                    {d.birim_adi && <span className="text-gray-400"> · {d.birim_adi}</span>}
                    {!d.tamamlandi && <span className="text-gray-300"> · devam ediyor</span>}
                  </span>
                  <span className="text-xs text-gray-400">
                    {d.puan}/{d.max_puan} <strong className="text-gray-600 font-medium">%{formatOranMetni(d.oran)}</strong>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${yuzde}%`, background: RAPOR_RENK }} />
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Yıllık puanınız, o yıl içinde başlayan dönemlerin puanları toplanarak oluşur.
        </p>
      </Card>

      <Card className="p-5">
        <RaporKategoriKirilimi kirilim={veri.kategori_kirilimi} baslik={`${veri.yil} Yılında Hangi Konuda Neredesiniz`} />
      </Card>
    </div>
  )
}
