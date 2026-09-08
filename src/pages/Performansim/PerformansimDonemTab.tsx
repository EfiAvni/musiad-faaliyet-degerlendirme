import { useState } from 'react'
import { ChevronDown, ChevronRight, FileCheck } from 'lucide-react'
import type { DonemPerformansi, PerformansFaaliyet } from '@/types/performans'
import type { FaaliyetKayit } from '@/types/faaliyetKayit'
import { GONDERIM_DURUM_ETIKET, GONDERIM_DURUM_RENK } from '@/types/gonderim'
import { RAPOR_RENK } from '@/utils/constants'
import { formatOranMetni, formatPercent, formatTarihKisa } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { RaporKategoriKirilimi } from '@/pages/Raporlar/RaporKategoriKirilimi'

export function PerformansimDonemTab({ veri, kayitlar }: {
  veri: DonemPerformansi
  kayitlar: FaaliyetKayit[]
}) {
  const [acikFaaliyet, setAcikFaaliyet] = useState<number | null>(null)

  if (!veri.donem || !veri.genel) {
    return <EmptyState icon={FileCheck} title="Görüntülenecek dönem bulunmuyor"
      subtitle="Birim yöneticiniz bir dönem açtığında performansınız burada görünecek." />
  }

  const { donem, genel } = veri

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Puan', value: `${genel.toplam_puan}`, alt: `${genel.max_puan} puan üzerinden`, color: RAPOR_RENK },
          { label: 'Başarı', value: `%${formatOranMetni(genel.basari_orani)}`, alt: 'bu dönem', color: '#059669' },
          { label: 'Girdiğiniz Kayıt', value: genel.kayit_sayisi, alt: 'toplam', color: '#2563eb' },
          { label: 'Kriter', value: veri.faaliyetler.length, alt: 'değerlendirmede', color: '#f59e0b' },
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

      {/* Doküman bölüm 11-12: ay ay merkezde hangi aşamada olduğu. */}
      {veri.ay_durumlari && veri.ay_durumlari.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Ayların Gönderim Durumu
          </h3>
          <div className="flex flex-wrap gap-2">
            {veri.ay_durumlari.map(a => (
              <div key={a.ay_id} className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs text-gray-600 mb-1">{a.ay}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: GONDERIM_DURUM_RENK[a.durum].bg, color: GONDERIM_DURUM_RENK[a.durum].text }}>
                  {GONDERIM_DURUM_ETIKET[a.durum]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
            Kriter Bazlı Puanınız
          </h3>
          <span className="text-xs text-gray-400">
            {donem.status === 'completed' ? 'Bu dönem tamamlandı, kayıtlar salt okunur' : 'Satıra tıklayarak girdiğiniz kayıtları görebilirsiniz'}
          </span>
        </div>

        {veri.faaliyetler.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Bu döneme kriter tanımlanmamış.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left font-medium text-gray-500 text-xs py-2 pr-3">Kriter</th>
                  <th className="text-left font-medium text-gray-500 text-xs py-2 px-3 whitespace-nowrap">Başlık</th>
                  <th className="text-right font-medium text-gray-500 text-xs py-2 px-3 whitespace-nowrap">Kayıt</th>
                  <th className="text-right font-medium text-gray-500 text-xs py-2 pl-3 whitespace-nowrap">Puan</th>
                </tr>
              </thead>
              <tbody>
                {veri.faaliyetler.map(f => (
                  <FaaliyetSatiri key={f.faaliyet_id} f={f}
                    kayitlar={kayitlar.filter(k => k.faaliyet_id === f.faaliyet_id)}
                    acik={acikFaaliyet === f.faaliyet_id}
                    onToggle={() => setAcikFaaliyet(acikFaaliyet === f.faaliyet_id ? null : f.faaliyet_id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <RaporKategoriKirilimi kirilim={veri.kategori_kirilimi} baslik="Hangi Konuda Neredesiniz" />
      </Card>
    </div>
  )
}

function FaaliyetSatiri({ f, kayitlar, acik, onToggle }: {
  f: PerformansFaaliyet
  kayitlar: FaaliyetKayit[]
  acik: boolean
  onToggle: () => void
}) {
  const yuzde = f.max_puan > 0 ? formatPercent(f.puan / f.max_puan) : 0

  return (
    <>
      <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
        <td className="py-2.5 pr-3">
          <button onClick={onToggle} className="flex items-center gap-1.5 text-left group">
            {acik ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
            <span className="text-gray-800 group-hover:text-gray-900 font-medium">{f.title}</span>
          </button>
        </td>
        <td className="py-2.5 px-3">
          <span className="text-xs text-gray-500">{f.kategori_adi}</span>
        </td>
        <td className="text-right py-2.5 px-3 text-gray-600">
          {f.kayit_sayisi}{f.hedef > 0 && <span className="text-gray-400"> / {f.hedef}</span>}
        </td>
        <td className="text-right py-2.5 pl-3">
          <span className="font-semibold text-gray-900">{f.puan}</span>
          <span className="text-gray-400"> / {f.max_puan}</span>
          <span className="ml-2 text-xs" style={{ color: RAPOR_RENK }}>%{yuzde}</span>
        </td>
      </tr>
      {acik && (
        <tr className="border-b border-gray-50">
          <td colSpan={4} className="py-3 px-3 bg-gray-50/60">
            {kayitlar.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Bu kritere kayıt girmediniz.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {kayitlar.map(k => (
                  <div key={k.id} className="p-3 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-gray-700">{k.deger}</p>
                      <p className="text-[11px] text-gray-400 flex-shrink-0">{formatTarihKisa(k.created_at)}</p>
                    </div>
                    {k.tarih && <p className="text-[11px] text-gray-400">Faaliyet tarihi: {formatTarihKisa(k.tarih)}</p>}
                    {k.aciklama && <p className="text-xs text-gray-500 mt-0.5">{k.aciklama}</p>}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
