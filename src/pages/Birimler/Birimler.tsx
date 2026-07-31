import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { birimlerApi } from '@/services/birimService'
import type { Birim as ApiBirim } from '@/types/birim'
import { useModal } from '@/hooks/useModal'
import { inputCls } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { SearchBar } from '@/components/common/SearchBar'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal, ConfirmModal } from '@/components/common/Modal'
import { FormField } from '@/components/common/FormField'

export function BirimlerPage() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ApiBirim[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  // create / edit modal state
  const [editItem, setEditItem] = useState<ApiBirim | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'passive'>('active')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const { target: deleteTarget, setTarget: setDeleteTarget, loading: deleting, setLoading: setDeleting } = useModal<ApiBirim>()

  const filtered = items.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  const loadBirimler = async () => {
    try {
      const data = await birimlerApi.list()
      setItems(data)
      setApiError('')
    } catch {
      setApiError('Birimler yüklenemedi. Backend bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBirimler() }, [])

  const openCreate = () => {
    setEditItem(null); setFormName(''); setFormYear(''); setFormStatus('active'); setFormError('')
    setShowModal(true)
  }

  const openEdit = (b: ApiBirim) => {
    setEditItem(b); setFormName(b.name); setFormYear(b.created_year ? String(b.created_year) : ''); setFormStatus(b.status); setFormError('')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditItem(null); setFormError('') }

  const handleSave = async () => {
    if (!formName.trim()) { setFormError('Birim adı zorunludur.'); return }
    setSaving(true); setFormError('')
    try {
      const payload = {
        name: formName.trim(),
        status: formStatus,
        created_year: formYear ? parseInt(formYear) : null,
      }
      if (editItem) {
        await birimlerApi.update(editItem.id, payload)
      } else {
        await birimlerApi.create(payload)
      }
      await loadBirimler()
      closeModal()
    } catch (e: any) {
      setFormError(e?.errors?.name?.[0] ?? e?.message ?? 'Kayıt sırasında hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await birimlerApi.destroy(deleteTarget.id)
      await loadBirimler()
      setDeleteTarget(null)
    } catch {
      // API hatası — liste sunucudan yeniden yüklenir, kayıt kalır
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Birimler" subtitle={`${items.length} birim kayıtlı`}
        actions={<Btn variant="primary" onClick={openCreate}><Plus size={14} />Birim Ekle</Btn>} />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <Card>
        <div className="flex items-center justify-between p-4 border-b border-gray-50">
          <SearchBar placeholder="Birim ara..." value={search} onChange={setSearch} />
          <span className="text-xs text-gray-400">{filtered.length} birim listeleniyor</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                {['Birim Adı', 'Şube Sayısı', 'Durum', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase ${i === 3 ? 'w-24' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                    Yükleniyor...
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  {search ? 'Arama sonucu bulunamadı' : 'Henüz birim eklenmedi'}
                </td></tr>
              ) : filtered.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60 group">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ background: '#7c3aed' }}>
                        {b.name.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.name}</p>
                        {b.created_year && <p className="text-xs text-gray-400">Kuruluş: {b.created_year}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">{b.subeler_count}</td>
                  <td className="px-4 py-4"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                        onClick={() => openEdit(b)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => setDeleteTarget(b)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {deleteTarget && (
        <ConfirmModal
          title="Birimi Sil"
          message={`"${deleteTarget.name}" birimini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {showModal && (
        <Modal title={editItem ? 'Birimi Düzenle' : 'Yeni Birim Ekle'} onClose={closeModal}>
          <div className="space-y-4">
            <FormField label="Birim Adı">
              <input className={inputCls} placeholder="Birim adını girin..." value={formName}
                onChange={e => setFormName(e.target.value)} />
            </FormField>
            <FormField label="Kuruluş Yılı">
              <input className={inputCls} type="number" placeholder="ör: 2020" min="1900" max="2099"
                value={formYear} onChange={e => setFormYear(e.target.value)} />
            </FormField>
            <FormField label="Durum">
              <select className={inputCls} value={formStatus} onChange={e => setFormStatus(e.target.value as 'active' | 'passive')}>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
              </select>
            </FormField>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={closeModal}>İptal</Btn>
              <Btn variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
