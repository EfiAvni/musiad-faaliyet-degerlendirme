import { useState, useEffect } from 'react'
import {
  Plus, Calendar, Building2, ListChecks, Edit2, PlayCircle, CheckCircle, Trash2,
} from 'lucide-react'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { subelerApi } from '@/services/subeService'
import type { Sube as ApiSube } from '@/types/sube'
import { useModal } from '@/hooks/useModal'
import { inputCls } from '@/utils/constants'
import { formatTarihUzun } from '@/utils/formatters'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal, ConfirmModal } from '@/components/common/Modal'
import { FormField } from '@/components/common/FormField'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { SubeScopeToggle } from './SubeScopeToggle'
import { SubeChecklist } from './SubeChecklist'
import { GecmisDonemlerListesi } from './GecmisDonemlerListesi'
import { GecmisDonemDetay } from './GecmisDonemDetay'

export function DonemlerPage({ onShowFaaliyetler, onShowRapor }: { onShowFaaliyetler: (donemId: number) => void; onShowRapor: (donemId: number) => void }) {
  const [items, setItems] = useState<ApiDonem[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  const [subeler, setSubeler] = useState<ApiSube[]>([])

  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formStartMonth, setFormStartMonth] = useState('')
  const [formEndMonth, setFormEndMonth] = useState('')
  const [formTumSubeler, setFormTumSubeler] = useState(true)
  const [formSubeIds, setFormSubeIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [editItem, setEditItem] = useState<ApiDonem | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartMonth, setEditStartMonth] = useState('')
  const [editEndMonth, setEditEndMonth] = useState('')
  const [editTumSubeler, setEditTumSubeler] = useState(true)
  const [editSubeIds, setEditSubeIds] = useState<number[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const { target: deleteTarget, setTarget: setDeleteTarget, loading: deleting, setLoading: setDeleting } = useModal<ApiDonem>()
  const { target: activateTarget, setTarget: setActivateTarget, loading: activating, setLoading: setActivating } = useModal<ApiDonem>()
  const { target: completeTarget, setTarget: setCompleteTarget, loading: completing, setLoading: setCompleting } = useModal<ApiDonem>()

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [aylarByDonem, setAylarByDonem] = useState<Record<number, ApiDonem['aylar']>>({})
  const [aylarLoading, setAylarLoading] = useState<number | null>(null)

  const [activeTab, setActiveTab] = useState<'mevcut' | 'gecmis'>('mevcut')
  const [detailDonem, setDetailDonem] = useState<ApiDonem | null>(null)

  const switchTab = (tab: 'mevcut' | 'gecmis') => { setActiveTab(tab); setDetailDonem(null) }

  const loadDonemler = async () => {
    try {
      const data = await donemlerApi.list()
      setItems(data)
      setApiError('')
    } catch {
      setApiError('Dönemler yüklenemedi. Backend bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  const loadSubeler = async () => {
    try {
      setSubeler(await subelerApi.list())
    } catch { /* şube listesi sadece seçim amaçlı, sessizce geç */ }
  }

  useEffect(() => { loadDonemler(); loadSubeler() }, [])

  const aktifDonemler = items.filter(d => d.status === 'active')
  const taslakDonemler = items.filter(d => d.status === 'pending')
  const gecmisDonemler = items.filter(d => d.status === 'completed')

  const formatTarih = formatTarihUzun

  const ayFarki = (startMonth: string, endMonth: string) => {
    if (!startMonth || !endMonth) return null
    const [sy, sm] = startMonth.split('-').map(Number)
    const [ey, em] = endMonth.split('-').map(Number)
    return (ey - sy) * 12 + (em - sm) + 1
  }

  const previewOzet = (startMonth: string, endMonth: string) => {
    const count = ayFarki(startMonth, endMonth)
    if (count === null) return ''
    if (count <= 0) return 'Bitiş ayı başlangıç ayından önce olamaz.'
    const [ey, em] = endMonth.split('-').map(Number)
    const end = new Date(ey, em, 0)
    return `Bu dönem ${count} aya bölünecek ve ${end.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })} tarihinde sona erecek.`
  }

  const openCreate = () => {
    setFormName(''); setFormStartMonth(''); setFormEndMonth('')
    setFormTumSubeler(true); setFormSubeIds([]); setFormError('')
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!formName.trim() || !formStartMonth || !formEndMonth) { setFormError('Dönem adı, başlangıç ve bitiş ayı zorunludur.'); return }
    const count = ayFarki(formStartMonth, formEndMonth)
    if (count !== null && count <= 0) { setFormError('Bitiş ayı başlangıç ayından önce olamaz.'); return }
    if (!formTumSubeler && formSubeIds.length === 0) { setFormError('Belirli şubeler için en az bir şube seçmelisiniz.'); return }
    setSaving(true); setFormError('')
    try {
      await donemlerApi.create({
        name: formName.trim(), start_date: `${formStartMonth}-01`, end_date: `${formEndMonth}-01`,
        tum_subeler: formTumSubeler, sube_ids: formTumSubeler ? undefined : formSubeIds,
      })
      await loadDonemler()
      setShowModal(false)
    } catch (e: any) {
      setFormError(e?.errors?.name?.[0] ?? e?.errors?.start_date?.[0] ?? e?.errors?.end_date?.[0] ?? e?.errors?.sube_ids?.[0] ?? e?.message ?? 'Kayıt sırasında hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (d: ApiDonem) => {
    setEditItem(d)
    setEditName(d.name)
    setEditStartMonth(d.start_date.slice(0, 7))
    setEditEndMonth(d.end_date.slice(0, 7))
    setEditTumSubeler(d.tum_subeler)
    setEditSubeIds((d.subeler ?? []).map(s => s.id))
    setEditError('')
    setShowEditModal(true)
  }

  const closeEditModal = () => { setShowEditModal(false); setEditItem(null); setEditError('') }

  const handleUpdate = async () => {
    if (!editItem || !editName.trim()) { setEditError('Dönem adı zorunludur.'); return }
    if (editItem.status === 'pending') {
      const count = ayFarki(editStartMonth, editEndMonth)
      if (count !== null && count <= 0) { setEditError('Bitiş ayı başlangıç ayından önce olamaz.'); return }
      if (!editTumSubeler && editSubeIds.length === 0) { setEditError('Belirli şubeler için en az bir şube seçmelisiniz.'); return }
    }
    setEditSaving(true); setEditError('')
    try {
      const payload: { name: string; start_date?: string; end_date?: string; tum_subeler?: boolean; sube_ids?: number[] } = { name: editName.trim() }
      if (editItem.status === 'pending') {
        if (editStartMonth && editStartMonth !== editItem.start_date.slice(0, 7)) {
          payload.start_date = `${editStartMonth}-01`
        }
        if (editEndMonth && editEndMonth !== editItem.end_date.slice(0, 7)) {
          payload.end_date = `${editEndMonth}-01`
        }
        payload.tum_subeler = editTumSubeler
        payload.sube_ids = editTumSubeler ? [] : editSubeIds
      }
      await donemlerApi.update(editItem.id, payload)
      await loadDonemler()
      setAylarByDonem(prev => { const next = { ...prev }; delete next[editItem.id]; return next })
      closeEditModal()
    } catch (e: any) {
      setEditError(e?.errors?.name?.[0] ?? e?.errors?.start_date?.[0] ?? e?.errors?.end_date?.[0] ?? e?.errors?.sube_ids?.[0] ?? e?.message ?? 'Güncelleme sırasında hata oluştu.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await donemlerApi.destroy(deleteTarget.id)
      await loadDonemler()
      setDeleteTarget(null)
    } catch (e: any) {
      setApiError(e?.errors?.status?.[0] ?? e?.message ?? 'Silme sırasında hata oluştu.')
    } finally {
      setDeleting(false)
    }
  }

  const handleActivate = async () => {
    if (!activateTarget) return
    setActivating(true)
    try {
      await donemlerApi.activate(activateTarget.id)
      await loadDonemler()
      setActivateTarget(null)
    } catch (e: any) {
      setApiError(e?.errors?.status?.[0] ?? e?.message ?? 'Aktifleştirme sırasında hata oluştu.')
    } finally {
      setActivating(false)
    }
  }

  const handleComplete = async () => {
    if (!completeTarget) return
    setCompleting(true)
    try {
      await donemlerApi.complete(completeTarget.id)
      await loadDonemler()
      setCompleteTarget(null)
    } catch (e: any) {
      setApiError(e?.errors?.status?.[0] ?? e?.message ?? 'Tamamlama sırasında hata oluştu.')
    } finally {
      setCompleting(false)
    }
  }

  const toggleAylar = async (d: ApiDonem) => {
    if (expandedId === d.id) { setExpandedId(null); return }
    setExpandedId(d.id)
    if (!aylarByDonem[d.id]) {
      setAylarLoading(d.id)
      try {
        const full = await donemlerApi.show(d.id)
        setAylarByDonem(prev => ({ ...prev, [d.id]: full.aylar ?? [] }))
      } catch { /* aylar yüklenemedi, sessizce geç */ }
      finally { setAylarLoading(null) }
    }
  }

  const handleAyOverrideChange = async (donemId: number, ayId: number, value: string) => {
    const override = value === 'auto' ? null : value === 'open'
    try {
      const updated = await donemlerApi.updateAy(ayId, override)
      setAylarByDonem(prev => ({
        ...prev,
        [donemId]: (prev[donemId] ?? []).map(a => a.id === ayId ? updated : a),
      }))
    } catch { /* güncelleme başarısız oldu, mevcut durum korunur */ }
  }

  const today = new Date()

  const renderAylar = (d: ApiDonem) => {
    if (expandedId !== d.id) return null
    if (aylarLoading === d.id) {
      return <div className="px-5 pb-5 text-xs text-gray-400">Aylar yükleniyor...</div>
    }
    const aylar = aylarByDonem[d.id]
    if (!aylar) return null
    return (
      <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-gray-50 pt-4 mt-1">
        {aylar.map(ay => {
          const isToday = today >= new Date(ay.start_date) && today <= new Date(ay.end_date)
          return (
            <div key={ay.id}
              className={`px-3 py-2 rounded-xl border text-xs ${ay.acik ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-1">
                <p className={`font-medium ${ay.acik ? 'text-emerald-700' : 'text-gray-700'}`}>{ay.name}{isToday ? ' · Şimdi' : ''}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ay.acik ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                  {ay.acik ? 'Açık' : 'Kapalı'}
                </span>
              </div>
              <select
                className="w-full mt-1.5 text-[11px] bg-white border border-gray-200 rounded-lg px-1.5 py-1 text-gray-600 focus:outline-none focus:border-emerald-400"
                value={ay.acik_override === null ? 'auto' : ay.acik_override ? 'open' : 'closed'}
                onChange={e => handleAyOverrideChange(d.id, ay.id, e.target.value)}>
                <option value="auto">Otomatik</option>
                <option value="open">Manuel Açık</option>
                <option value="closed">Manuel Kapalı</option>
              </select>
            </div>
          )
        })}
      </div>
    )
  }

  const renderCard = (d: ApiDonem, variant: 'active' | 'pending') => (
    <Card key={d.id}
      className={`overflow-hidden transition-all ${variant === 'active' ? 'ring-2 ring-emerald-300' : ''}`}>
      <div className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: variant === 'active' ? '#B99C1A15' : '#f9fafb' }}>
              <Calendar size={20} style={{ color: variant === 'active' ? '#B99C1A' : '#9ca3af' }} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{d.name}</h3>
              <p className="text-sm text-gray-400 mt-0.5">
                {formatTarih(d.start_date)} – {formatTarih(d.end_date)} · {d.faaliyetler_count ?? 0} faaliyet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-medium"
              title={d.tum_subeler ? undefined : (d.subeler ?? []).map(s => s.name).join(', ')}>
              <Building2 size={12} />
              {d.tum_subeler ? 'Tüm Şubeler' : `${d.subeler?.length ?? 0} Şube`}
            </span>
            <StatusBadge status={d.status} />
            <Btn variant="ghost" size="sm" onClick={() => toggleAylar(d)}>
              <Calendar size={13} />{expandedId === d.id ? 'Ayları Gizle' : 'Ayları Göster'}
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => onShowFaaliyetler(d.id)}>
              <ListChecks size={13} />Faaliyetler
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => openEdit(d)}>
              <Edit2 size={13} />Düzenle
            </Btn>
            {variant === 'pending' && (
              <Btn variant="primary" size="sm" onClick={() => setActivateTarget(d)}>
                <PlayCircle size={13} />Aktif Et
              </Btn>
            )}
            {variant === 'active' && (
              <Btn variant="secondary" size="sm" onClick={() => setCompleteTarget(d)}>
                <CheckCircle size={13} />Dönemi Tamamla
              </Btn>
            )}
            {variant === 'pending' && (
              <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => setDeleteTarget(d)} title="Sil">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
      {renderAylar(d)}
    </Card>
  )

  return (
    <div className="animate-fade-in">
      <PageHeader title="Dönemler" subtitle="Değerlendirme dönemlerini yönetin — istediğiniz aralıkta, aylara bölünerek"
        actions={activeTab === 'mevcut' ? <Btn variant="primary" onClick={openCreate}><Plus size={14} />Dönem Aç</Btn> : undefined} />

      <div className="inline-flex items-center gap-1 p-1 bg-gray-50 rounded-xl mb-6">
        <button onClick={() => switchTab('mevcut')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'mevcut' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Mevcut Dönemler
        </button>
        <button onClick={() => switchTab('gecmis')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'gecmis' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Geçmiş Dönemler
          {gecmisDonemler.length > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{gecmisDonemler.length}</span>
          )}
        </button>
      </div>

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      {activeTab === 'gecmis' ? (
        detailDonem ? (
          <GecmisDonemDetay donem={detailDonem} onBack={() => setDetailDonem(null)} onShowRapor={onShowRapor} />
        ) : (
          <GecmisDonemlerListesi items={gecmisDonemler} loading={loading}
            onSelect={setDetailDonem} onDelete={setDeleteTarget} formatTarih={formatTarih} />
        )
      ) : loading ? (
        <Loading />
      ) : aktifDonemler.length === 0 && taslakDonemler.length === 0 ? (
        <EmptyState icon={Calendar} title="Henüz dönem açılmadı" subtitle="Yeni bir değerlendirme dönemi açarak başlayın." />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Aktif Dönemler</h3>
            {aktifDonemler.length > 0 ? (
              <div className="grid gap-4">
                {aktifDonemler.map(d => renderCard(d, 'active'))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-sm text-gray-500">Şu anda aktif bir dönem yok.</p>
                <p className="text-xs text-gray-400 mt-1">
                  {taslakDonemler.length > 0 ? 'Taslak dönemlerden birini aktif edin.' : 'Yeni bir dönem açıp aktif edin.'}
                </p>
              </Card>
            )}
          </div>

          {taslakDonemler.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Taslak Dönemler</h3>
              <div className="grid gap-4">
                {taslakDonemler.map(d => renderCard(d, 'pending'))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal title="Yeni Dönem Aç" onClose={() => setShowModal(false)} wide={!formTumSubeler}>
          <div className={formTumSubeler ? '' : 'grid grid-cols-[18rem_1fr] gap-6'}>
            <div className="space-y-4">
              <FormField label="Dönem Adı">
                <input className={inputCls} placeholder="örn: 2026-2027 Değerlendirme Dönemi" value={formName}
                  onChange={e => setFormName(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Başlangıç Ayı">
                  <input type="month" className={inputCls} value={formStartMonth} onChange={e => setFormStartMonth(e.target.value)} />
                </FormField>
                <FormField label="Bitiş Ayı">
                  <input type="month" className={inputCls} value={formEndMonth} onChange={e => setFormEndMonth(e.target.value)} />
                </FormField>
              </div>
              {formStartMonth && formEndMonth && (
                <p className="text-xs text-gray-400 -mt-2">{previewOzet(formStartMonth, formEndMonth)}</p>
              )}
              <SubeScopeToggle tumSubeler={formTumSubeler} setTumSubeler={setFormTumSubeler} />
            </div>
            {!formTumSubeler && (
              <SubeChecklist subeIds={formSubeIds} setSubeIds={setFormSubeIds} subeler={subeler} />
            )}
          </div>
          {formError && <p className="text-xs text-red-500 mt-4">{formError}</p>}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Btn variant="secondary" onClick={() => setShowModal(false)}>İptal</Btn>
            <Btn variant="primary" onClick={handleCreate}
              disabled={saving || !formName.trim() || !formStartMonth || !formEndMonth || (!formTumSubeler && formSubeIds.length === 0)}>
              {saving ? 'Oluşturuluyor...' : 'Dönem Aç'}
            </Btn>
          </div>
        </Modal>
      )}

      {showEditModal && editItem && (
        <Modal title="Dönemi Düzenle" onClose={closeEditModal} wide={editItem.status === 'pending' && !editTumSubeler}>
          <div className={editItem.status === 'pending' && !editTumSubeler ? 'grid grid-cols-[18rem_1fr] gap-6' : ''}>
            <div className="space-y-4">
              <FormField label="Dönem Adı">
                <input className={inputCls} value={editName} onChange={e => setEditName(e.target.value)} />
              </FormField>
              {editItem.status === 'pending' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Başlangıç Ayı">
                      <input type="month" className={inputCls} value={editStartMonth} onChange={e => setEditStartMonth(e.target.value)} />
                    </FormField>
                    <FormField label="Bitiş Ayı">
                      <input type="month" className={inputCls} value={editEndMonth} onChange={e => setEditEndMonth(e.target.value)} />
                    </FormField>
                  </div>
                  {editStartMonth && editEndMonth && (
                    <p className="text-xs text-gray-400 -mt-2">{previewOzet(editStartMonth, editEndMonth)} (aylar yeniden oluşturulacak)</p>
                  )}
                  <SubeScopeToggle tumSubeler={editTumSubeler} setTumSubeler={setEditTumSubeler} />
                </>
              ) : (
                <p className="text-xs text-gray-400">
                  Bu dönem {editItem.status === 'active' ? 'aktif' : 'tamamlanmış'} olduğu için tarih aralığı ve şube kapsamı değiştirilemez, sadece adı düzenlenebilir.
                  {' '}Kapsam: {editItem.tum_subeler ? 'Tüm Şubeler' : (editItem.subeler ?? []).map(s => s.name).join(', ') || 'şube seçilmedi'}.
                </p>
              )}
            </div>
            {editItem.status === 'pending' && !editTumSubeler && (
              <SubeChecklist subeIds={editSubeIds} setSubeIds={setEditSubeIds} subeler={subeler} />
            )}
          </div>
          {editError && <p className="text-xs text-red-500 mt-4">{editError}</p>}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Btn variant="secondary" onClick={closeEditModal}>İptal</Btn>
            <Btn variant="primary" onClick={handleUpdate}
              disabled={editSaving || !editName.trim() || (editItem.status === 'pending' && !editTumSubeler && editSubeIds.length === 0)}>
              {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </Btn>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Dönemi Sil"
          message={`"${deleteTarget.name}" dönemini silmek istediğinize emin misiniz? Döneme bağlı tüm faaliyetler de silinecektir. Bu işlem geri alınamaz.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {activateTarget && (
        <ConfirmModal
          title="Dönemi Aktif Et"
          confirmLabel="Aktif Et"
          message={`"${activateTarget.name}" dönemini aktif etmek istediğinize emin misiniz? Aktif edildikten sonra kullanıma başlanabilir. Diğer aktif dönemler etkilenmez, aynı anda birden fazla dönem aktif olabilir.`}
          onCancel={() => setActivateTarget(null)}
          onConfirm={handleActivate}
          loading={activating}
        />
      )}

      {completeTarget && (
        <ConfirmModal
          title="Dönemi Tamamla"
          confirmLabel="Tamamla"
          message={`"${completeTarget.name}" dönemini tamamlamak istediğinize emin misiniz? Tamamlanan bir dönem bir daha aktif edilemez.`}
          onCancel={() => setCompleteTarget(null)}
          onConfirm={handleComplete}
          loading={completing}
        />
      )}
    </div>
  )
}
