import { useState, useEffect } from 'react'
import { Plus, FileCheck } from 'lucide-react'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { useModal } from '@/hooks/useModal'
import { inputCls } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { SearchBar } from '@/components/common/SearchBar'
import { FormField } from '@/components/common/FormField'
import { Modal, ConfirmModal } from '@/components/common/Modal'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { FaaliyetFormFields } from '@/components/forms/FaaliyetForm'
import { FaaliyetCard } from './FaaliyetCard'

export function FaaliyetlerPage({ initialDonemId }: { initialDonemId: number | null }) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ApiFaaliyet[]>([])
  const [donemler, setDonemler] = useState<ApiDonem[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [donemFilter, setDonemFilter] = useState<number | null>(initialDonemId)

  const [showModal, setShowModal] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDetay, setFormDetay] = useState('')
  const [formPuan, setFormPuan] = useState('')
  const [formHedef, setFormHedef] = useState('')
  const [formAciklama, setFormAciklama] = useState('')
  const [formTarihGerekli, setFormTarihGerekli] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [editItem, setEditItem] = useState<ApiFaaliyet | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDetay, setEditDetay] = useState('')
  const [editPuan, setEditPuan] = useState('')
  const [editHedef, setEditHedef] = useState('')
  const [editAciklama, setEditAciklama] = useState('')
  const [editTarihGerekli, setEditTarihGerekli] = useState(false)
  const [editDonemId, setEditDonemId] = useState<number | ''>('')
  const [editDurum, setEditDurum] = useState<'active' | 'completed' | 'passive'>('active')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const { target: deleteTarget, setTarget: setDeleteTarget, loading: deleting, setLoading: setDeleting } = useModal<ApiFaaliyet>()

  const loadFaaliyetler = async (donemId: number | null) => {
    setLoading(true)
    try {
      const data = await faaliyetlerApi.list(donemId ?? undefined)
      setItems(data)
      setApiError('')
    } catch {
      setApiError('Faaliyetler yüklenemedi. Backend bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  const loadDonemler = async () => {
    try {
      setDonemler(await donemlerApi.list())
    } catch { /* dönem listesi sadece seçim/filtre amaçlı, sessizce geç */ }
  }

  useEffect(() => { loadFaaliyetler(donemFilter) }, [donemFilter])
  useEffect(() => { loadDonemler() }, [])

  const selectableDonemler = donemler.filter(d => d.status !== 'completed')

  useEffect(() => {
    if (donemFilter !== null || selectableDonemler.length === 0) return
    const active = selectableDonemler.find(d => d.status === 'active')
    if (active) setDonemFilter(active.id)
  }, [donemler])

  useEffect(() => {
    if (donemFilter === null) return
    const current = donemler.find(d => d.id === donemFilter)
    if (current && current.status === 'completed') setDonemFilter(null)
  }, [donemler, donemFilter])

  const filtered = items.filter(f => f.title.toLowerCase().includes(search.toLowerCase()))
  const aktifDonemler = donemler.filter(d => d.status === 'active')
  const filterDonem = selectableDonemler.find(d => d.id === donemFilter)
  const canCreate = !!filterDonem
  const toplamHedef = items.reduce((sum, f) => sum + f.hedef, 0)
  const tarihliCount = items.filter(f => f.tarih_gerekli).length

  const openCreate = () => {
    if (!canCreate) return
    setFormTitle(''); setFormDetay(''); setFormPuan(''); setFormHedef('')
    setFormAciklama(''); setFormTarihGerekli(false)
    setFormError('')
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!formTitle.trim() || !donemFilter) { setFormError('Faaliyet adı zorunludur ve bir dönem seçilmelidir.'); return }
    setSaving(true); setFormError('')
    try {
      await faaliyetlerApi.create({
        title: formTitle.trim(),
        detay: formDetay.trim() || null,
        puan: parseInt(formPuan) || 0,
        hedef: parseInt(formHedef) || 0,
        aciklama: formAciklama.trim() || null,
        tarih_gerekli: formTarihGerekli,
        donem_id: donemFilter,
      })
      await loadFaaliyetler(donemFilter)
      setShowModal(false)
    } catch (e: any) {
      setFormError(e?.errors?.donem_id?.[0] ?? e?.errors?.title?.[0] ?? e?.message ?? 'Kayıt sırasında hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (f: ApiFaaliyet) => {
    setEditItem(f)
    setEditTitle(f.title)
    setEditDetay(f.detay ?? '')
    setEditPuan(String(f.puan))
    setEditHedef(String(f.hedef))
    setEditAciklama(f.aciklama ?? '')
    setEditTarihGerekli(f.tarih_gerekli)
    setEditDonemId(f.donem_id)
    setEditDurum(f.durum)
    setEditError('')
    setShowEditModal(true)
  }

  const closeEditModal = () => { setShowEditModal(false); setEditItem(null); setEditError('') }

  const handleUpdate = async () => {
    if (!editItem || !editTitle.trim() || !editDonemId) { setEditError('Faaliyet adı ve dönem zorunludur.'); return }
    setEditSaving(true); setEditError('')
    try {
      await faaliyetlerApi.update(editItem.id, {
        title: editTitle.trim(),
        detay: editDetay.trim() || null,
        puan: parseInt(editPuan) || 0,
        hedef: parseInt(editHedef) || 0,
        aciklama: editAciklama.trim() || null,
        tarih_gerekli: editTarihGerekli,
        donem_id: Number(editDonemId),
        durum: editDurum,
      })
      await loadFaaliyetler(donemFilter)
      closeEditModal()
    } catch (e: any) {
      setEditError(e?.errors?.donem_id?.[0] ?? e?.message ?? 'Güncelleme sırasında hata oluştu.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await faaliyetlerApi.destroy(deleteTarget.id)
      await loadFaaliyetler(donemFilter)
      setDeleteTarget(null)
    } catch {
      // API hatası — liste sunucudan yeniden yüklenir, kayıt kalır
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Faaliyetler"
        subtitle={
          aktifDonemler.length === 0 ? 'Aktif dönem yok'
          : aktifDonemler.length === 1 ? `Aktif dönem: ${aktifDonemler[0].name}`
          : `Aktif dönemler: ${aktifDonemler.map(d => d.name).join(', ')}`
        }
        actions={<Btn variant="primary" onClick={openCreate} disabled={!canCreate}><Plus size={14} />Faaliyet Oluştur</Btn>} />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <div className="mb-4 flex items-end gap-3 flex-wrap">
        <div className="w-64">
          <FormField label="Dönem">
            <select className={inputCls} value={donemFilter ?? ''}
              onChange={e => setDonemFilter(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Dönem seçin...</option>
              {selectableDonemler.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.status === 'active' ? ' (Aktif)' : ' (Taslak)'}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        {!donemFilter && (
          <p className="text-xs text-amber-600 pb-2.5">Faaliyet oluşturmak ve listelemek için önce bir dönem seçin.</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Toplam Faaliyet', value: items.length,      color: '#B99C1A' },
          { label: 'Tarihli',         value: tarihliCount,      color: '#2563eb' },
          { label: 'Toplam Hedef', value: toplamHedef, color: '#f59e0b' },
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

      <div className="mb-4">
        <SearchBar placeholder="Faaliyet ara..." value={search} onChange={setSearch} />
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileCheck} title={search ? 'Arama sonucu bulunamadı' : 'Henüz faaliyet eklenmedi'} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <FaaliyetCard key={f.id} f={f} onEdit={() => openEdit(f)} onDelete={() => setDeleteTarget(f)} />
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Yeni Faaliyet Oluştur" onClose={() => setShowModal(false)}>
          {filterDonem && (
            <p className="text-xs text-gray-500 mb-4 -mt-1">
              Bu faaliyet <strong className="text-gray-700">{filterDonem.name}</strong> dönemine eklenecek.
            </p>
          )}
          <FaaliyetFormFields
            title={formTitle} setTitle={setFormTitle}
            detay={formDetay} setDetay={setFormDetay}
            puan={formPuan} setPuan={setFormPuan}
            hedef={formHedef} setHedef={setFormHedef}
            aciklama={formAciklama} setAciklama={setFormAciklama}
            tarihGerekli={formTarihGerekli} setTarihGerekli={setFormTarihGerekli}
          />
          {formError && <p className="text-xs text-red-500 mt-3">{formError}</p>}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Btn variant="secondary" onClick={() => setShowModal(false)}>İptal</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving || !formTitle.trim() || !donemFilter}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Btn>
          </div>
        </Modal>
      )}

      {showEditModal && editItem && (
        <Modal title="Faaliyeti Düzenle" onClose={closeEditModal}>
          <FaaliyetFormFields
            title={editTitle} setTitle={setEditTitle}
            detay={editDetay} setDetay={setEditDetay}
            puan={editPuan} setPuan={setEditPuan}
            hedef={editHedef} setHedef={setEditHedef}
            aciklama={editAciklama} setAciklama={setEditAciklama}
            tarihGerekli={editTarihGerekli} setTarihGerekli={setEditTarihGerekli}
            donemId={editDonemId} setDonemId={setEditDonemId}
            donemOptions={selectableDonemler}
            durum={editDurum} setDurum={setEditDurum}
          />
          {editError && <p className="text-xs text-red-500 mt-3">{editError}</p>}
          <div className="flex items-center justify-end gap-2 pt-4">
            <Btn variant="secondary" onClick={closeEditModal}>İptal</Btn>
            <Btn variant="primary" onClick={handleUpdate} disabled={editSaving || !editTitle.trim()}>
              {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </Btn>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Faaliyeti Sil"
          message={`"${deleteTarget.title}" faaliyetini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  )
}
