import { Building2, Users, Calendar, Activity, Plus, ChevronRight, UserCog, Shield, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Page } from '@/types/navigation'
import { birimler, subeler, donemler } from '@/utils/constants'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { KpiCard } from '@/components/common/KpiCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { kullanicilarApi } from '@/services/kullaniciService'

export function SuperAdminDashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [usersCount, setUsersCount] = useState<number | string>('...')

  useEffect(() => {
    kullanicilarApi.list().then(data => setUsersCount(data.length)).catch(() => setUsersCount('?'))
  }, [])

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
          Sistem Yönetimi
        </h1>
        <p className="text-sm text-gray-500 mt-1">Pazartesi, 28 Temmuz 2024 — Genel sistem durumu</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Toplam Birim"      value={`${birimler.length}`}                                     change="0" changeType="neutral" icon={Building2}  color="#7c3aed" />
        <KpiCard label="Toplam Şube"       value={`${subeler.length}`}                                      change="0" changeType="neutral" icon={Activity}   color="#B99C1A" />
        <KpiCard label="Kayıtlı Kullanıcı" value={`${usersCount}`}                                          change="0" changeType="neutral" icon={Users}      color="#2563eb" />
        <KpiCard label="Aktif Dönem"       value={`${donemler.filter(d => d.status === 'active').length}`}  change="0" changeType="neutral" icon={Calendar}   color="#f59e0b" />
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
            {birimler.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: '#7c3aed' }}>
                    {b.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{b.name}</p>
                    <p className="text-xs text-gray-400">{b.sube_count} şube · {b.yonetici}</p>
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
              { label: 'Birim Yönet',             icon: Building2, color: '#7c3aed', page: 'birimler'     as Page },
              { label: 'Kullanıcıları Yönet',      icon: UserCog,  color: '#2563eb', page: 'kullanicilar' as Page },
              { label: 'Rol & Yetkileri Düzenle',  icon: Shield,   color: '#B99C1A', page: 'roller'       as Page },
              { label: 'Genel Ayarlar',             icon: Settings, color: '#6b7280', page: 'ayarlar'      as Page },
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
            <p className="text-xs text-gray-400 mt-0.5">Şube ve faaliyet dağılımı</p>
          </div>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate('birimler')}>Tümünü gör <ChevronRight size={13} /></Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Birim', 'Yönetici', 'Şube', 'Faaliyet', 'Durum'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {birimler.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.yonetici}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.sube_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.faaliyet_count}</td>
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
