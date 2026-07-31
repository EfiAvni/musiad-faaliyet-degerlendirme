import { useState, useEffect } from 'react'
import { ChevronLeft, Archive, Building2, BarChart3 } from 'lucide-react'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import { formatTarihUzun } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Loading } from '@/components/common/Loading'

export function GecmisDonemDetay({ donem, onBack, onShowRapor }: { donem: ApiDonem; onBack: () => void; onShowRapor: (donemId: number) => void }) {
  const [detail, setDetail] = useState<ApiDonem | null>(null)
  const [faaliyetler, setFaaliyetler] = useState<ApiFaaliyet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([donemlerApi.show(donem.id), faaliyetlerApi.list(donem.id)])
      .then(([full, faaliyetData]) => {
        if (cancelled) return
        setDetail(full)
        setFaaliyetler(faaliyetData)
      })
      .catch(() => { /* detay yüklenemedi, mevcut özet bilgilerle devam edilir */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [donem.id])

  const formatTarih = formatTarihUzun

  const toplamHedef = faaliyetler.reduce((sum, f) => sum + f.hedef, 0)
  const scope = donem.tum_subeler ? 'Tüm Şubeler' : `${donem.subeler?.length ?? 0} Şube`

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ChevronLeft size={15} />Geçmiş Dönemlere Dön
      </button>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gray-50">
              <Archive size={24} className="text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{donem.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{formatTarih(donem.start_date)} – {formatTarih(donem.end_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-medium"
              title={donem.tum_subeler ? undefined : (donem.subeler ?? []).map(s => s.name).join(', ')}>
              <Building2 size={12} />{scope}
            </span>
            <StatusBadge status="completed" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam Faaliyet', value: faaliyetler.length, color: '#B99C1A' },
          { label: 'Toplam Hedef', value: toplamHedef, color: '#f59e0b' },
          { label: 'Değerlendirme Ayı', value: detail?.aylar?.length ?? '—', color: '#2563eb' },
        ].map((s, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ background: s.color }} />
            <div>
              <p className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {detail?.aylar && detail.aylar.length > 0 && (
        <Card className="p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Değerlendirme Ayları</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {detail.aylar.map(ay => (
              <div key={ay.id} className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-xs font-medium text-gray-600">
                {ay.name}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Faaliyetler</h3>
        {loading ? (
          <Loading />
        ) : faaliyetler.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-400">Bu döneme faaliyet tanımlanmamış.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {faaliyetler.map(f => (
              <Card key={f.id} className="p-4 flex flex-col gap-2">
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                {f.detay && <p className="text-xs text-gray-500">{f.detay}</p>}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-medium">
                    Puan: <strong className="text-gray-800">{f.puan}</strong>
                  </span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium">
                    Hedef: <strong>{f.hedef}</strong>
                  </span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                    Maks: <strong>{f.max_puan}</strong>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="p-6 text-center">
        <BarChart3 size={22} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm font-medium text-gray-500 mb-1">Detaylı Raporlama</p>
        <p className="text-xs text-gray-400 mb-4">Şube bazlı puan sıralaması, faaliyet doluluk oranları ve aylık kayıt grafikleriyle tam raporu görüntüleyin.</p>
        <Btn variant="primary" onClick={() => onShowRapor(donem.id)}>
          <BarChart3 size={14} />Raporu Görüntüle
        </Btn>
      </Card>
    </div>
  )
}
