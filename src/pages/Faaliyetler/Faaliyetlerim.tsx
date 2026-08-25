import { useState, useEffect } from 'react'
import { Calendar, FileCheck, Edit2, Trash2, Plus, Send } from 'lucide-react'
import { gonderimlerApi } from '@/services/gonderimService'
import type { Gonderim, GonderimDurum } from '@/types/gonderim'
import { GONDERIM_DURUM_ETIKET, GONDERIM_DURUM_RENK } from '@/types/gonderim'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import { faaliyetKayitlariApi } from '@/services/faaliyetKayitService'
import type { FaaliyetKayit as ApiFaaliyetKayit } from '@/types/faaliyetKayit'
import { useModal } from '@/hooks/useModal'
import { inputCls } from '@/utils/constants'
import { formatTarihUzun } from '@/utils/formatters'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { FormField } from '@/components/common/FormField'
import { Modal, ConfirmModal } from '@/components/common/Modal'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'

export function FaaliyetlerimPage() {
  const [activeDonemler, setActiveDonemler] = useState<ApiDonem[]>([])
  const [selectedDonemId, setSelectedDonemId] = useState<number | null>(null)
  const [aylar, setAylar] = useState<ApiDonem['aylar']>([])
  const [faaliyetler, setFaaliyetler] = useState<ApiFaaliyet[]>([])
  const [kayitlar, setKayitlar] = useState<ApiFaaliyetKayit[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  const [kayitModal, setKayitModal] = useState<{ mode: 'create' | 'edit'; faaliyet: ApiFaaliyet; kayit?: ApiFaaliyetKayit } | null>(null)
  const [formTarih, setFormTarih] = useState('')
  const [formDeger, setFormDeger] = useState('')
  const [formAciklama, setFormAciklama] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const { target: deleteTarget, setTarget: setDeleteTarget, loading: deleting, setLoading: setDeleting } = useModal<ApiFaaliyetKayit>()

  const [gonderimler, setGonderimler] = useState<Gonderim[]>([])
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [gonderimHata, setGonderimHata] = useState('')
  const [gonderOnayi, setGonderOnayi] = useState(false)

  const loadDonemData = async (donemId: number) => {
    try {
      const [full, faaliyetData, kayitData, gonderimData] = await Promise.all([
        donemlerApi.show(donemId),
        faaliyetlerApi.list(donemId),
        faaliyetKayitlariApi.list(),
        gonderimlerApi.list({ donem_id: donemId }),
      ])
      setAylar(full.aylar ?? [])
      setFaaliyetler(faaliyetData)
      setKayitlar(kayitData)
      setGonderimler(gonderimData)
      setApiError('')
    } catch {
      setApiError('Veriler yüklenemedi. Backend bağlantısını kontrol edin.')
    }
  }

  const loadInitial = async () => {
    setLoading(true)
    try {
      const donemlerData = await donemlerApi.list()
      const aktifler = donemlerData.filter(d => d.status === 'active')
      setActiveDonemler(aktifler)
      const firstId = aktifler[0]?.id ?? null
      setSelectedDonemId(firstId)
      if (firstId !== null) {
        await loadDonemData(firstId)
      } else {
        setAylar([]); setFaaliyetler([]); setKayitlar([])
      }
      setApiError('')
    } catch {
      setApiError('Veriler yüklenemedi. Backend bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitial() }, [])

  const handleDonemChange = async (donemId: number | null) => {
    setSelectedDonemId(donemId)
    if (donemId === null) { setAylar([]); setFaaliyetler([]); setKayitlar([]); return }
    setLoading(true)
    await loadDonemData(donemId)
    setLoading(false)
  }

  const loadAll = async () => {
    if (selectedDonemId !== null) await loadDonemData(selectedDonemId)
  }

  const activeDonem = activeDonemler.find(d => d.id === selectedDonemId) ?? null

  // Şube tüm birimlere aynı hesapla kayıt girer (Teşkilatlanma, GENÇ MÜSİAD...).
  // Dönemleri birime göre grupluyoruz ki hangi birime çalışıldığı görünür olsun.
  const birimGruplari = activeDonemler.reduce<{ birimId: number; birimAdi: string; donemler: ApiDonem[] }[]>((gruplar, d) => {
    const mevcut = gruplar.find(g => g.birimId === d.birim_id)
    if (mevcut) {
      mevcut.donemler.push(d)
    } else {
      gruplar.push({ birimId: d.birim_id, birimAdi: d.birim?.name ?? 'Birim', donemler: [d] })
    }
    return gruplar
  }, [])

  const aktifGrup = birimGruplari.find(g => g.donemler.some(d => d.id === selectedDonemId)) ?? null
  const cokBirimliMi = birimGruplari.length > 1

  const acikAy = (aylar ?? []).find(a => a.acik)
  const kayitlarByFaaliyet = (faaliyetId: number) => kayitlar.filter(k => k.faaliyet_id === faaliyetId)

  // Gönderim kaydı olmayan ay taslaktır - backend o ay için satır tutmuyor.
  const acikAyGonderimi = acikAy ? gonderimler.find(g => g.donem_ay_id === acikAy.id) ?? null : null
  const gonderimDurumu: GonderimDurum = acikAyGonderimi?.durum ?? 'taslak'
  const subeDuzenleyebilir = gonderimDurumu === 'taslak' || gonderimDurumu === 'duzeltme_bekliyor'
  const acikAyKayitSayisi = acikAy ? kayitlar.filter(k => k.donem_ay_id === acikAy.id).length : 0
  const gonderilebilir = Boolean(acikAy) && subeDuzenleyebilir && acikAyKayitSayisi > 0

  const handleGonder = async () => {
    if (!acikAy) return
    setGonderiliyor(true)
    setGonderimHata('')
    try {
      await gonderimlerApi.gonder(acikAy.id)
      await loadAll()
      setGonderOnayi(false)
    } catch (e: any) {
      setGonderimHata(
        e?.errors?.donem_ay_id?.[0] ?? e?.errors?.durum?.[0] ?? e?.errors?.sube_id?.[0]
        ?? e?.message ?? 'Gönderim sırasında hata oluştu.',
      )
      setGonderOnayi(false)
    } finally {
      setGonderiliyor(false)
    }
  }

  const openCreate = (f: ApiFaaliyet) => {
    setKayitModal({ mode: 'create', faaliyet: f })
    setFormTarih(''); setFormDeger(''); setFormAciklama(''); setFormError('')
  }

  const openEdit = (f: ApiFaaliyet, k: ApiFaaliyetKayit) => {
    setKayitModal({ mode: 'edit', faaliyet: f, kayit: k })
    setFormTarih(k.tarih ? k.tarih.slice(0, 10) : '')
    setFormDeger(k.deger)
    setFormAciklama(k.aciklama ?? '')
    setFormError('')
  }

  const closeModal = () => { setKayitModal(null); setFormError('') }

  const handleSave = async () => {
    if (!kayitModal) return
    if (!formDeger.trim()) { setFormError(`${kayitModal.faaliyet.detay || 'Detay'} alanı zorunludur.`); return }
    if (kayitModal.faaliyet.tarih_gerekli && !formTarih) { setFormError('Bu faaliyet için tarih seçimi zorunludur.'); return }
    setSaving(true); setFormError('')
    try {
      if (kayitModal.mode === 'create') {
        await faaliyetKayitlariApi.create({
          faaliyet_id: kayitModal.faaliyet.id,
          tarih: kayitModal.faaliyet.tarih_gerekli ? formTarih : null,
          deger: formDeger.trim(),
          aciklama: formAciklama.trim() || null,
        })
      } else if (kayitModal.kayit) {
        await faaliyetKayitlariApi.update(kayitModal.kayit.id, {
          tarih: kayitModal.faaliyet.tarih_gerekli ? formTarih : null,
          deger: formDeger.trim(),
          aciklama: formAciklama.trim() || null,
        })
      }
      await loadAll()
      closeModal()
    } catch (e: any) {
      setFormError(e?.errors?.deger?.[0] ?? e?.errors?.tarih?.[0] ?? e?.errors?.faaliyet_id?.[0] ?? e?.errors?.donem_ay_id?.[0] ?? e?.message ?? 'Kayıt sırasında hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await faaliyetKayitlariApi.destroy(deleteTarget.id)
      await loadAll()
      setDeleteTarget(null)
    } catch {
      // API hatası — liste sunucudan yeniden yüklenir
    } finally {
      setDeleting(false)
    }
  }

  const formatTarih = formatTarihUzun

  return (
    <div className="animate-fade-in">
      <PageHeader title="Faaliyetlerim"
        subtitle={activeDonem
          ? `${activeDonem.birim?.name ? `${activeDonem.birim.name} · ` : ''}${activeDonem.name}${acikAy ? ` · ${acikAy.name} için giriş açık` : ' · Açık değerlendirme ayı yok'}`
          : 'Aktif dönem yok'} />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      {cokBirimliMi && (
        <div className="mb-4">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 w-fit max-w-full overflow-x-auto">
            {birimGruplari.map(g => {
              const secili = aktifGrup?.birimId === g.birimId
              return (
                <button key={g.birimId} onClick={() => handleDonemChange(g.donemler[0].id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    secili ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {g.birimAdi}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Şubeniz her birime ayrı kayıt girer. Sekmeler arasında geçiş yaparak o birimin faaliyetlerini görebilirsiniz.
          </p>
        </div>
      )}

      {/* Bir birimde birden fazla aktif dönem olması beklenmez ama olursa seçilebilsin. */}
      {(aktifGrup?.donemler.length ?? 0) > 1 && (
        <div className="mb-4 w-64">
          <FormField label="Dönem">
            <select className={inputCls} value={selectedDonemId ?? ''}
              onChange={e => handleDonemChange(e.target.value ? Number(e.target.value) : null)}>
              {aktifGrup?.donemler.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </FormField>
        </div>
      )}

      {!loading && activeDonem && !acikAy && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
          Şu anda açık bir değerlendirme ayı bulunmuyor. Yeni kayıt eklenemez; gerekirse birim yöneticinizle iletişime geçin.
        </div>
      )}

      {/* Ayın merkeze gönderim durumu ve gönderme eylemi (doküman bölüm 12) */}
      {!loading && acikAy && (
        <Card className="mb-4 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{acikAy.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: GONDERIM_DURUM_RENK[gonderimDurumu].bg,
                    color: GONDERIM_DURUM_RENK[gonderimDurumu].text,
                  }}>
                  {GONDERIM_DURUM_ETIKET[gonderimDurumu]}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {gonderimDurumu === 'taslak' && (
                  acikAyKayitSayisi > 0
                    ? `${acikAyKayitSayisi} kayıt girildi. Tamamladığınızda merkeze gönderin.`
                    : 'Henüz kayıt girmediniz. En az bir kayıt ekledikten sonra gönderebilirsiniz.'
                )}
                {gonderimDurumu === 'gonderildi' && 'Merkez incelemesi bekleniyor. İnceleme bitene kadar kayıt değiştiremezsiniz.'}
                {gonderimDurumu === 'duzeltme_bekliyor' && 'Merkez düzeltme istedi. Gerekli değişikliği yapıp tekrar gönderin.'}
                {gonderimDurumu === 'onaylandi' && 'Merkez bu ayı onayladı. Kayıtlar kilitlendi.'}
              </p>
            </div>

            {gonderimDurumu !== 'onaylandi' && gonderimDurumu !== 'gonderildi' && (
              <Btn variant="primary" onClick={() => { setGonderimHata(''); setGonderOnayi(true) }}
                disabled={!gonderilebilir || gonderiliyor}>
                <Send size={13} />
                {gonderimDurumu === 'duzeltme_bekliyor' ? 'Tekrar Gönder' : 'Merkeze Gönder'}
              </Btn>
            )}
          </div>

          {acikAyGonderimi?.merkez_notu && (
            <div className="mt-3 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <span className="text-xs font-semibold uppercase tracking-wide block mb-1">Merkez notu</span>
              {acikAyGonderimi.merkez_notu}
            </div>
          )}

          {gonderimHata && <p className="text-xs text-red-500 mt-3">{gonderimHata}</p>}
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : !activeDonem ? (
        <EmptyState icon={Calendar} title="Şu anda aktif bir değerlendirme dönemi yok" subtitle="Birim yöneticiniz yeni bir dönem açtığında faaliyetler burada görünecek." />
      ) : faaliyetler.length === 0 ? (
        <EmptyState icon={FileCheck} title="Bu döneme henüz faaliyet tanımlanmadı" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {faaliyetler.map(f => {
            const kayitList = kayitlarByFaaliyet(f.id)
            return (
              <Card key={f.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                    {f.detay && <p className="text-xs text-gray-500 mt-1">{f.detay}</p>}
                  </div>
                  {f.tarih_gerekli && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium flex-shrink-0">Tarihli</span>
                  )}
                </div>

                {f.aciklama && <p className="text-xs text-gray-400 border-t border-gray-50 pt-2">{f.aciklama}</p>}

                <div className="space-y-2">
                  {kayitList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Henüz kayıt eklenmedi.</p>
                  ) : kayitList.map(k => (
                    <div key={k.id} className="flex items-start justify-between gap-2 p-3 bg-gray-50 rounded-xl">
                      <div className="min-w-0">
                        {k.tarih && <p className="text-xs text-gray-400 mb-0.5">{formatTarih(k.tarih)}</p>}
                        <p className="text-sm text-gray-800 font-medium">{k.deger}</p>
                        {k.aciklama && <p className="text-xs text-gray-500 mt-0.5">{k.aciklama}</p>}
                      </div>
                      {k.donem_ay?.acik && subeDuzenleyebilir && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button className="p-1 hover:bg-gray-200 rounded-lg text-gray-400" onClick={() => openEdit(f, k)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="p-1 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-500" onClick={() => setDeleteTarget(k)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Btn variant="secondary" size="sm" onClick={() => openCreate(f)} disabled={!acikAy || !subeDuzenleyebilir}>
                  <Plus size={13} />Kayıt Ekle
                </Btn>
              </Card>
            )
          })}
        </div>
      )}

      {kayitModal && (
        <Modal title={kayitModal.mode === 'create' ? 'Faaliyet Kaydı Ekle' : 'Kaydı Düzenle'} onClose={closeModal}>
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-800">{kayitModal.faaliyet.title}</p>

            <FormField label={kayitModal.faaliyet.detay || 'Detay'}>
              <input className={inputCls} placeholder="İlgili veriyi girin..." value={formDeger} onChange={e => setFormDeger(e.target.value)} />
            </FormField>

            {kayitModal.faaliyet.tarih_gerekli && (() => {
              const kayitAyi = kayitModal.mode === 'edit' ? kayitModal.kayit?.donem_ay : acikAy
              const minTarih = kayitAyi?.start_date?.slice(0, 10)
              const maxTarih = kayitAyi?.end_date?.slice(0, 10)
              return (
                <FormField label="Tarih">
                  <input type="date" className={inputCls} value={formTarih} min={minTarih} max={maxTarih}
                    onChange={e => setFormTarih(e.target.value)} />
                  {kayitAyi && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Yalnızca {kayitAyi.name} ayı içinde bir tarih seçebilirsiniz.
                    </p>
                  )}
                </FormField>
              )
            })()}

            <FormField label="Açıklama (opsiyonel)">
              <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Eklemek istediğiniz ek bir not varsa yazabilirsiniz..."
                value={formAciklama} onChange={e => setFormAciklama(e.target.value)} />
            </FormField>

            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={closeModal}>İptal</Btn>
              <Btn variant="primary" onClick={handleSave} disabled={saving || !formDeger.trim()}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Kaydı Sil"
          message="Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {gonderOnayi && acikAy && (
        <ConfirmModal
          title="Merkeze Gönder"
          message={`${acikAy.name} ayına girdiğiniz ${acikAyKayitSayisi} kayıt merkeze gönderilecek. Gönderdikten sonra merkez inceleyene kadar kayıt ekleyemez veya değiştiremezsiniz.`}
          confirmLabel="Gönder"
          variant="primary"
          onCancel={() => setGonderOnayi(false)}
          onConfirm={handleGonder}
          loading={gonderiliyor}
        />
      )}
    </div>
  )
}
