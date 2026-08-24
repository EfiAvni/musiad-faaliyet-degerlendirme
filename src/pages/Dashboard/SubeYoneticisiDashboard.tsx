import { useState, useEffect } from 'react'
import { ClipboardList, CheckCircle, Target, ChevronRight } from 'lucide-react'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import { faaliyetKayitlariApi } from '@/services/faaliyetKayitService'
import type { FaaliyetKayit as ApiFaaliyetKayit } from '@/types/faaliyetKayit'
import type { User } from '@/types/auth'
import type { Page } from '@/types/navigation'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { KpiCard } from '@/components/common/KpiCard'

export function SubeYoneticisiDashboard({ onNavigate, user }: { onNavigate: (p: Page) => void; user: User }) {
  const [activeDonemler, setActiveDonemler] = useState<ApiDonem[]>([])
  const [faaliyetler, setFaaliyetler] = useState<ApiFaaliyet[]>([])
  const [kayitlar, setKayitlar] = useState<ApiFaaliyetKayit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const donemlerData = await donemlerApi.list()
        const aktifler = donemlerData.filter(d => d.status === 'active')
        setActiveDonemler(aktifler)
        if (aktifler.length > 0) {
          const [faaliyetLists, kayitData] = await Promise.all([
            Promise.all(aktifler.map(d => faaliyetlerApi.list(d.id))),
            faaliyetKayitlariApi.list(),
          ])
          setFaaliyetler(faaliyetLists.flat())
          setKayitlar(kayitData)
        }
      } catch { /* dashboard verisi yüklenemedi, sessizce geç */ }
      finally { setLoading(false) }
    })()
  }, [])

  const kayitliFaaliyetIds = new Set(kayitlar.map(k => k.faaliyet_id))
  const kapsananSayisi = faaliyetler.filter(f => kayitliFaaliyetIds.has(f.id)).length
  const toplam = faaliyetler.length
  const pct = toplam > 0 ? Math.round((kapsananSayisi / toplam) * 100) : 0

  // Şube her birime ayrı kayıt girdiği için tek bir birleşik oran yanıltıcı
  // olur; birim başına kırılım da gösteriyoruz.
  const birimKirilimi = activeDonemler.map(d => {
    const donemFaaliyetleri = faaliyetler.filter(f => f.donem_id === d.id)
    const kapsanan = donemFaaliyetleri.filter(f => kayitliFaaliyetIds.has(f.id)).length
    return {
      donemId: d.id,
      birimAdi: d.birim?.name ?? 'Birim',
      donemAdi: d.name,
      toplam: donemFaaliyetleri.length,
      kapsanan,
      pct: donemFaaliyetleri.length > 0 ? Math.round((kapsanan / donemFaaliyetleri.length) * 100) : 0,
    }
  })
  const birimSayisi = new Set(activeDonemler.map(d => d.birim_id)).size
  const cokBirimliMi = birimSayisi > 1
  const birimAdiByDonem = new Map(activeDonemler.map(d => [d.id, d.birim?.name ?? 'Birim']))

  const donemSubtitle = activeDonemler.length === 0
    ? 'Aktif dönem yok'
    : cokBirimliMi
      ? `${birimSayisi} birimde ${activeDonemler.length} aktif dönem`
      : `Aktif dönem: ${activeDonemler[0].name}`

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
          Hoş geldiniz, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.sube_adi ?? 'Şube atanmamış'} — {donemSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Toplam Faaliyet" value={`${toplam}`}          change="0" changeType="neutral" icon={ClipboardList} color="#B99C1A" />
        <KpiCard label="Kayıt Girilen"    value={`${kapsananSayisi}`}  change="0" changeType="neutral" icon={CheckCircle}  color="#a38817" />
        <KpiCard label="Kapsanma Oranı"   value={`%${pct}`}            change={pct >= 75 ? 'İyi' : 'Devam ediyor'} changeType={pct >= 75 ? 'up' : 'neutral'} icon={Target} color="#2563eb" />
      </div>

      {cokBirimliMi && (
        <Card className="p-6 mb-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-1" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Birim Bazında İlerleme</h3>
          <p className="text-xs text-gray-400 mb-4">Şubeniz her birime ayrı kayıt girer</p>
          <div className="space-y-4">
            {birimKirilimi.map(b => (
              <div key={b.donemId}>
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{b.birimAdi}</p>
                    <p className="text-xs text-gray-400 truncate">{b.donemAdi}</p>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0 tabular-nums" style={{ color: '#B99C1A' }}>
                    {b.kapsanan}/{b.toplam} · %{b.pct}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.pct}%`, background: '#B99C1A' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              {cokBirimliMi ? 'Toplam İlerleme' : 'Genel İlerleme'}
            </h3>
            <span className="text-sm font-semibold" style={{ color: '#B99C1A' }}>{pct}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: '#B99C1A' }} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 mt-5">
          <h4 className="text-sm font-medium text-gray-700">Faaliyet Listesi (Önizleme)</h4>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate('faaliyetlerim')}>Tümünü gör <ChevronRight size={13} /></Btn>
        </div>
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-gray-400">Yükleniyor...</p>
          ) : faaliyetler.length === 0 ? (
            <p className="text-sm text-gray-400">{activeDonemler.length > 0 ? 'Bu dönemlere henüz faaliyet tanımlanmadı.' : 'Aktif dönem bulunmuyor.'}</p>
          ) : faaliyetler.slice(0, 4).map(f => {
            const kayitli = kayitliFaaliyetIds.has(f.id)
            return (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                {kayitli
                  ? <CheckCircle size={18} style={{ color: '#B99C1A' }} className="flex-shrink-0" />
                  : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${kayitli ? 'text-gray-800' : 'text-gray-500'}`}>{f.title}</p>
                  {cokBirimliMi
                    ? <p className="text-xs text-gray-400 truncate">{birimAdiByDonem.get(f.donem_id) ?? '—'}</p>
                    : f.detay && <p className="text-xs text-gray-400 truncate">{f.detay}</p>}
                </div>
                {f.tarih_gerekli && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex-shrink-0">Tarihli</span>}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
