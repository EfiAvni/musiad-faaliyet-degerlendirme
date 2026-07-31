import { useState, useEffect } from 'react'
import { Building2, ClipboardList, CheckCircle, Calendar, ChevronRight, BarChart3, FileCheck } from 'lucide-react'
import { subelerApi } from '@/services/subeService'
import type { Sube as ApiSube } from '@/types/sube'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { raporlarApi } from '@/services/raporService'
import type { DonemRaporu } from '@/types/rapor'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import type { User } from '@/types/auth'
import type { Page } from '@/types/navigation'
import { formatPercent } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { KpiCard } from '@/components/common/KpiCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Loading } from '@/components/common/Loading'

export function BirimYoneticisiDashboard({ onNavigate, user }: { onNavigate: (p: Page) => void; user: User }) {
  const [subeler, setSubeler] = useState<ApiSube[]>([])
  const [donemler, setDonemler] = useState<ApiDonem[]>([])
  const [rapor, setRapor] = useState<DonemRaporu | null>(null)
  const [faaliyetler, setFaaliyetler] = useState<ApiFaaliyet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const [subelerData, donemlerData] = await Promise.all([
          subelerApi.list(),
          donemlerApi.list(),
        ])
        setSubeler(subelerData)
        setDonemler(donemlerData)

        const odakDonem = donemlerData.find(d => d.status === 'active')
        if (odakDonem) {
          const [raporData, faaliyetData] = await Promise.all([
            raporlarApi.donemRaporu(odakDonem.id),
            faaliyetlerApi.list(odakDonem.id),
          ])
          setRapor(raporData)
          setFaaliyetler(faaliyetData)
        } else {
          setRapor(null)
          setFaaliyetler([])
        }
      } catch { /* dashboard verisi yüklenemedi, sessizce geç */ }
      finally { setLoading(false) }
    })()
  }, [])

  const aktifDonemler = donemler.filter(d => d.status === 'active')
  const odakDonem = aktifDonemler[0]
  const tamamlayanSube = rapor ? rapor.sube_bazli.filter(s => s.max_puan > 0 && s.tamamlanma_orani >= 1).length : 0
  const donemSubtitle = aktifDonemler.length === 0
    ? 'Aktif dönem yok'
    : aktifDonemler.length === 1
      ? `Aktif dönem: ${aktifDonemler[0].name}`
      : `Aktif dönemler: ${aktifDonemler.map(d => d.name).join(', ')}`

  if (loading) {
    return (
      <div className="animate-fade-in">
        <Loading />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
          Hoş geldiniz, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">{user.birim} — {donemSubtitle}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Kayıtlı Şube"    value={`${subeler.length}`}                    change="0" changeType="neutral" icon={Building2}    color="#2563eb" />
        <KpiCard label="Aktif Faaliyet"  value={`${rapor?.genel.toplam_faaliyet ?? 0}`} change="0" changeType="neutral" icon={ClipboardList} color="#B99C1A" />
        <KpiCard label="Tamamlayan Şube" value={`${tamamlayanSube}`}                    change="0" changeType="neutral" icon={CheckCircle}  color="#a38817" />
        <KpiCard label="Aktif Dönem"     value={`${aktifDonemler.length}`}              change="0" changeType="neutral" icon={Calendar}     color="#f59e0b" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card className="col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Şube Faaliyet Durumu</h3>
              <p className="text-xs text-gray-400 mt-0.5">{odakDonem ? odakDonem.name : 'Aktif dönem bulunmuyor'}</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => onNavigate('raporlar')}>Tümünü gör <ChevronRight size={13} /></Btn>
          </div>
          {!rapor || rapor.sube_bazli.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">
                {odakDonem ? 'Bu dönem kapsamında değerlendirilecek şube bulunmuyor.' : 'Aktif bir dönem açıldığında şube performansı burada görünecek.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rapor.sube_bazli.slice(0, 6).map(s => {
                const pct = formatPercent(s.tamamlanma_orani)
                return (
                  <div key={s.sube_id} className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 w-36 flex-shrink-0 truncate">{s.sube_adi}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: pct >= 80 ? '#B99C1A' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{s.toplam_puan}/{s.max_puan}</span>
                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{pct}%</span>
                  </div>
                )
              })}
              {rapor.sube_bazli.length > 6 && (
                <p className="text-xs text-gray-400 pt-1">+{rapor.sube_bazli.length - 6} şube daha — tam raporda görüntüleyin.</p>
              )}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-4" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Hızlı İşlemler</h3>
          <div className="space-y-2">
            {[
              { label: 'Şube Yönet',       icon: Building2,     color: '#2563eb', page: 'subeler'     as Page },
              { label: 'Faaliyet Oluştur', icon: ClipboardList, color: '#B99C1A', page: 'faaliyetler' as Page },
              { label: 'Dönem Aç',         icon: Calendar,      color: '#f59e0b', page: 'donemler'    as Page },
              { label: 'Raporları Gör',    icon: BarChart3,     color: '#059669', page: 'raporlar'    as Page },
            ].map((item, i) => {
              const Icon = item.icon
              return (
                <button key={i} onClick={() => onNavigate(item.page)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}12` }}>
                    <Icon size={15} style={{ color: item.color }} />
                  </div>
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <ChevronRight size={14} className="ml-auto text-gray-300" />
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Aktif Dönem Faaliyetleri</h3>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate('faaliyetler')}>Tümünü gör <ChevronRight size={13} /></Btn>
        </div>
        {faaliyetler.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">
              {odakDonem ? 'Bu döneme henüz faaliyet tanımlanmadı.' : 'Aktif bir dönem açtığınızda faaliyetler burada görünecek.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {faaliyetler.slice(0, 4).map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#B99C1A15' }}>
                    <FileCheck size={13} style={{ color: '#B99C1A' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.title}</p>
                    {f.detay && <p className="text-xs text-gray-400 truncate">{f.detay}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {f.tarih_gerekli && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Tarihli</span>}
                  <StatusBadge status={f.durum} />
                </div>
              </div>
            ))}
            {faaliyetler.length > 4 && (
              <p className="text-xs text-gray-400 pt-1">+{faaliyetler.length - 4} faaliyet daha — Faaliyetler sayfasında görüntüleyin.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
