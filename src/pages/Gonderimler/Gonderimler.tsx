import { useState, useEffect } from 'react'
import { Inbox, CheckCircle2, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { gonderimlerApi } from '@/services/gonderimService'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet } from '@/types/faaliyet'
import type { Gonderim, GonderimDurum } from '@/types/gonderim'
import { GONDERIM_DURUM_ETIKET, GONDERIM_DURUM_RENK } from '@/types/gonderim'
import { inputCls } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { Modal } from '@/components/common/Modal'
import { FormField } from '@/components/common/FormField'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'

type Sekme = 'gonderildi' | 'duzeltme_bekliyor' | 'onaylandi' | 'tumu'

const SEKMELER: { id: Sekme; label: string }[] = [
  { id: 'gonderildi', label: 'İnceleme Bekleyen' },
  { id: 'duzeltme_bekliyor', label: 'Düzeltme Bekleyen' },
  { id: 'onaylandi', label: 'Onaylanan' },
  { id: 'tumu', label: 'Tümü' },
]

const tarihFormatla = (deger: string | null) =>
  deger ? new Date(deger).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

export function GonderimlerPage() {
  const [items, setItems] = useState<Gonderim[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [sekme, setSekme] = useState<Sekme>('gonderildi')

  const [duzeltmeTarget, setDuzeltmeTarget] = useState<Gonderim | null>(null)
  const [not, setNot] = useState('')
  const [islemde, setIslemde] = useState(false)
  const [formHata, setFormHata] = useState('')

  // Elle puanlanan kriterler (doküman bölüm 5) — otomatik hesaplananlar burada görünmez.
  const [puanTarget, setPuanTarget] = useState<Gonderim | null>(null)
  const [manuelFaaliyetler, setManuelFaaliyetler] = useState<Faaliyet[]>([])
  const [puanlar, setPuanlar] = useState<Record<number, string>>({})
  const [puanYukleniyor, setPuanYukleniyor] = useState(false)
  const [puanHata, setPuanHata] = useState('')

  const openPuanla = async (g: Gonderim) => {
    setPuanTarget(g)
    setPuanHata('')
    setManuelFaaliyetler([])
    setPuanYukleniyor(true)
    try {
      const donemId = g.donem_ay?.donem_id
      const hepsi = donemId ? await faaliyetlerApi.list(donemId) : []
      const manuel = hepsi.filter(f => f.kriter_turu === 'manuel')
      setManuelFaaliyetler(manuel)

      // Daha önce verilmiş puanlar forma önyüklenir.
      const mevcut: Record<number, string> = {}
      for (const d of g.degerlendirmeler ?? []) mevcut[d.faaliyet_id] = String(d.puan)
      setPuanlar(mevcut)
    } catch {
      setPuanHata('Faaliyetler yüklenemedi.')
    } finally {
      setPuanYukleniyor(false)
    }
  }

  const handlePuanKaydet = async () => {
    if (!puanTarget) return
    setIslemde(true)
    setPuanHata('')
    try {
      for (const f of manuelFaaliyetler) {
        const ham = puanlar[f.id]
        if (ham === undefined || ham === '') continue
        await gonderimlerApi.puanla(puanTarget.id, f.id, parseInt(ham) || 0)
      }
      await load()
      setPuanTarget(null)
    } catch (e: any) {
      setPuanHata(e?.errors?.puan?.[0] ?? e?.errors?.faaliyet_id?.[0] ?? e?.message ?? 'Puan kaydedilemedi.')
    } finally {
      setIslemde(false)
    }
  }

  const load = async () => {
    try {
      setItems(await gonderimlerApi.list())
      setApiError('')
    } catch {
      setApiError('Gönderimler yüklenemedi. Backend bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sayim = (d: GonderimDurum) => items.filter(g => g.durum === d).length
  const gosterilen = sekme === 'tumu' ? items : items.filter(g => g.durum === sekme)

  const handleOnayla = async (g: Gonderim) => {
    setIslemde(true)
    try {
      await gonderimlerApi.onayla(g.id)
      await load()
    } catch (e: any) {
      setApiError(e?.errors?.durum?.[0] ?? e?.message ?? 'Onaylama sırasında hata oluştu.')
    } finally {
      setIslemde(false)
    }
  }

  const handleDuzeltmeIste = async () => {
    if (!duzeltmeTarget) return
    if (not.trim().length < 5) { setFormHata('Şubenin neyi düzelteceğini anlaması için en az 5 karakterlik bir açıklama yazın.'); return }

    setIslemde(true)
    setFormHata('')
    try {
      await gonderimlerApi.duzeltmeIste(duzeltmeTarget.id, not.trim())
      await load()
      setDuzeltmeTarget(null)
      setNot('')
    } catch (e: any) {
      setFormHata(e?.errors?.merkez_notu?.[0] ?? e?.errors?.durum?.[0] ?? e?.message ?? 'İşlem sırasında hata oluştu.')
    } finally {
      setIslemde(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Gönderimler"
        subtitle="Şubelerin merkeze gönderdiği aylar — inceleyin, onaylayın veya düzeltme isteyin" />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 w-fit max-w-full overflow-x-auto mb-4">
        {SEKMELER.map(s => {
          const adet = s.id === 'tumu' ? items.length : sayim(s.id)
          return (
            <button key={s.id} onClick={() => setSekme(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                sekme === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {s.label}
              {adet > 0 && <span className="ml-1.5 text-xs text-gray-400 tabular-nums">{adet}</span>}
            </button>
          )
        })}
      </div>

      {loading ? (
        <Loading />
      ) : gosterilen.length === 0 ? (
        <EmptyState icon={Inbox}
          title={sekme === 'gonderildi' ? 'İnceleme bekleyen gönderim yok' : 'Bu listede gönderim yok'}
          subtitle="Şubeler bir ayı tamamlayıp gönderdiğinde burada görünür." />
      ) : (
        <div className="space-y-3">
          {gosterilen.map(g => (
            <Card key={g.id} className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
                      {g.sube?.name ?? 'Şube'}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: GONDERIM_DURUM_RENK[g.durum].bg, color: GONDERIM_DURUM_RENK[g.durum].text }}>
                      {GONDERIM_DURUM_ETIKET[g.durum]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {g.donem_ay?.name ?? 'Ay'} · {tarihFormatla(g.gonderildi_at)} tarihinde gönderildi
                    {g.gonderen?.name ? ` · ${g.gonderen.name}` : ''}
                  </p>
                  {g.degerlendiren?.name && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tarihFormatla(g.degerlendirildi_at)} · {g.degerlendiren.name} tarafından değerlendirildi
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {g.durum === 'gonderildi' && (
                    <>
                      <Btn variant="secondary" size="sm" onClick={() => openPuanla(g)} disabled={islemde}>
                        <SlidersHorizontal size={13} />Puanla
                      </Btn>
                      <Btn variant="primary" size="sm" onClick={() => handleOnayla(g)} disabled={islemde}>
                        <CheckCircle2 size={13} />Onayla
                      </Btn>
                    </>
                  )}
                  {(g.durum === 'gonderildi' || g.durum === 'onaylandi') && (
                    <Btn variant="secondary" size="sm"
                      onClick={() => { setDuzeltmeTarget(g); setNot(''); setFormHata('') }} disabled={islemde}>
                      <RotateCcw size={13} />
                      {g.durum === 'onaylandi' ? 'Geri Aç' : 'Düzeltme İste'}
                    </Btn>
                  )}
                </div>
              </div>

              {g.merkez_notu && (
                <div className="mt-3 px-3 py-2.5 rounded-xl text-sm bg-gray-50 text-gray-600">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 block mb-1">Merkez notu</span>
                  {g.merkez_notu}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {duzeltmeTarget && (
        <Modal
          title={duzeltmeTarget.durum === 'onaylandi' ? 'Onayı Geri Al' : 'Düzeltme İste'}
          onClose={() => setDuzeltmeTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-800">{duzeltmeTarget.sube?.name}</span>
              {' · '}{duzeltmeTarget.donem_ay?.name}
            </p>

            <FormField label="Şubeye iletilecek açıklama">
              <textarea className={`${inputCls} min-h-24 resize-y`} autoFocus
                placeholder="Neyin düzeltilmesi gerektiğini açıkça yazın..."
                value={not} onChange={e => setNot(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1.5">
                Bu not şubenin ekranında görünür ve ay tekrar düzenlenebilir hale gelir.
              </p>
            </FormField>

            {formHata && <p className="text-xs text-red-500">{formHata}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setDuzeltmeTarget(null)} disabled={islemde}>İptal</Btn>
              <Btn variant="primary" onClick={handleDuzeltmeIste} disabled={islemde || not.trim().length < 5}>
                {islemde ? 'Gönderiliyor...' : 'Düzeltme İste'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {puanTarget && (
        <Modal title="Kriterleri Puanla" onClose={() => setPuanTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-800">{puanTarget.sube?.name}</span>
              {' · '}{puanTarget.donem_ay?.name}
            </p>

            {puanYukleniyor ? (
              <Loading />
            ) : manuelFaaliyetler.length === 0 ? (
              <p className="text-sm text-gray-500">
                Bu dönemde elle puanlanan kriter yok. Diğer kriterler şubenin girdiği kayıtlardan
                otomatik hesaplanıyor.
              </p>
            ) : (
              <div className="space-y-3">
                {manuelFaaliyetler.map(f => (
                  <div key={f.id} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{f.title}</p>
                      <p className="text-xs text-gray-400">En fazla {f.max_puan} puan</p>
                    </div>
                    {/* inputCls w-full taşıyor; sınıf sırası Tailwind'de üstünlük
                        belirlemediği için genişliği doğrudan değiştiriyoruz. */}
                    <input type="number" min="0" max={f.max_puan} placeholder="0"
                      className={`${inputCls.replace('w-full', 'w-24')} flex-shrink-0`}
                      value={puanlar[f.id] ?? ''}
                      onChange={e => setPuanlar({ ...puanlar, [f.id]: e.target.value })} />
                  </div>
                ))}
              </div>
            )}

            {puanHata && <p className="text-xs text-red-500">{puanHata}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setPuanTarget(null)} disabled={islemde}>Kapat</Btn>
              {manuelFaaliyetler.length > 0 && (
                <Btn variant="primary" onClick={handlePuanKaydet} disabled={islemde}>
                  {islemde ? 'Kaydediliyor...' : 'Puanları Kaydet'}
                </Btn>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
