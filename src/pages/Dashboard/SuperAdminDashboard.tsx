import { useState, useEffect } from 'react'
import { Building2, Users, Calendar, Activity, Plus, ChevronRight, UserCog, BarChart3 } from 'lucide-react'
import type { Page } from '@/types/navigation'
import { birimlerApi } from '@/services/birimService'
import type { Birim } from '@/types/birim'
import { subelerApi } from '@/services/subeService'
import type { Sube } from '@/types/sube'
import { donemlerApi } from '@/services/donemService'
import type { Donem } from '@/types/donem'
import { kullanicilarApi } from '@/services/kullaniciService'
import type { User } from '@/types/auth'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { KpiCard } from '@/components/common/KpiCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Loading } from '@/components/common/Loading'

const bugun = new Date().toLocaleDateString('tr-TR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

export function SuperAdminDashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [birimler, setBirimler] = useState<Birim[]>([])
  const [subeler, setSubeler] = useState<Sube[]>([])
  const [donemler, setDonemler] = useState<Donem[]>([])
  const [kullanicilar, setKullanicilar] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const [birimData, subeData, donemData, kullaniciData] = await Promise.all([
          birimlerApi.list(),
          subelerApi.list(),
          donemlerApi.list(),
          kullanicilarApi.list(),
        ])
        setBirimler(birimData)
        setSubeler(subeData)
        setDonemler(donemData)
        setKullanicilar(kullaniciData)
      } catch {
        setApiError('Sistem özeti yüklenemedi. Backend bağlantısını kontrol edin.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const aktifDonemSayisi = donemler.filter(d => d.status === 'active').length
  const aktifDonemAdi = (birimId: number) =>
    donemler.find(d => d.birim_id === birimId && d.status === 'active')?.name ?? '—'

  if (loading) return <Loading />

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
          Sistem Yönetimi
        </h1>
        <p className="text-sm text-gray-500 mt-1">{bugun} — Genel sistem durumu</p>
      </div>

      {apiError && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Toplam Birim"      value={`${birimler.length}`}      change="0" changeType="neutral" icon={Building2} color="#7c3aed" />
        <KpiCard label="Toplam Şube"       value={`${subeler.length}`}       change="0" changeType="neutral" icon={Activity}  color="#B99C1A" />
        <KpiCard label="Kayıtlı Kullanıcı" value={`${kullanicilar.length}`}  change="0" changeType="neutral" icon={Users}     color="#2563eb" />
        <KpiCard label="Aktif Dönem"       value={`${aktifDonemSayisi}`}     change="0" changeType="neutral" icon={Calendar}  color="#f59e0b" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Birimler</h3>
              <p className="text-xs text-gray-400 mt-0.5">Kayıtlı tüm birimler</p>
            </div>
            <Btn variant="primary" size="sm" onClick={() => onNavigate('birimler')}><Plus size={13} />Birim Ekle</Btn>
          </div>
          <div className="space-y-3">
            {birimler.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Henüz birim eklenmemiş.</p>
            )}
            {birimler.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: '#7c3aed' }}>
                    {b.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{b.name}</p>
                    <p className="text-xs text-gray-400">{b.donemler_count} dönem</p>
                  </div>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 text-sm mb-4" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Hızlı İşlemler</h3>
          <div className="space-y-2">
            {[
              { label: 'Birim Yönet',              icon: Building2, color: '#7c3aed', page: 'birimler'     as Page },
              { label: 'Şubeleri Yönet',           icon: Activity,  color: '#B99C1A', page: 'subeler'      as Page },
              { label: 'Dönemleri Yönet',          icon: Calendar,  color: '#f59e0b', page: 'donemler'     as Page },
              { label: 'Kullanıcıları Yönet',      icon: UserCog,   color: '#2563eb', page: 'kullanicilar' as Page },
              { label: 'Raporları Görüntüle',      icon: BarChart3, color: '#6b7280', page: 'raporlar'     as Page },
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
          <div>
            <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Birim Özeti</h3>
            <p className="text-xs text-gray-400 mt-0.5">Her birim tüm şubeleri kapsar; dönemler birime özeldir</p>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate('birimler')}>Tümünü gör <ChevronRight size={13} /></Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Birim', 'Kuruluş', 'Dönem', 'Aktif Dönem', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {birimler.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.created_year ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{b.donemler_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{aktifDonemAdi(b.id)}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
