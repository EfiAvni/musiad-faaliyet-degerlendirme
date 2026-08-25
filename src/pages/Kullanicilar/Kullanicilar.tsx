import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, KeyRound } from 'lucide-react'
import type { User } from '@/types/auth'
import { roleColor, inputCls } from '@/utils/constants'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { SearchBar } from '@/components/common/SearchBar'
import { Modal } from '@/components/common/Modal'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { KullaniciFormFields, type KullaniciFormState } from '@/components/forms/KullaniciForm'
import { kullanicilarApi } from '@/services/kullaniciService'
import { birimlerApi } from '@/services/birimService'
import { subelerApi } from '@/services/subeService'
import type { Birim } from '@/types/birim'
import type { Sube } from '@/types/sube'
import { Loading } from '@/components/common/Loading'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/common/Pagination'

const SAYFA_BOYUTU = 20

export function KullanicilarPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [formData, setFormData] = useState<KullaniciFormState>({ name: '', email: '', role: 'superadmin', password: '' })
  const [saving, setSaving] = useState(false)

  // Parola sıfırlama ayrı bir akış: yönetici rol/birim alanlarına dokunmadan
  // yalnızca yeni parolayı girer.
  const [parolaTarget, setParolaTarget] = useState<User | null>(null)
  const [yeniParola, setYeniParola] = useState('')
  const [parolaSaving, setParolaSaving] = useState(false)
  const [parolaError, setParolaError] = useState('')
  const [parolaBasarili, setParolaBasarili] = useState('')

  const [birimler, setBirimler] = useState<Birim[]>([])
  const [subeler, setSubeler] = useState<Sube[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
    fetchOptions()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await kullanicilarApi.list()
      setUsers(data)
    } catch (err: any) {
      setError(err.message || 'Kullanıcılar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const fetchOptions = async () => {
    try {
      const b = await birimlerApi.list()
      const s = await subelerApi.list()
      setBirimler(b)
      setSubeler(s)
    } catch (err) {
      console.error('Birim veya şubeler yüklenemedi', err)
    }
  }

  const handleOpenAdd = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', role: 'superadmin', password: '' })
    setShowModal(true)
  }

  const handleOpenEdit = (u: User) => {
    setEditingUser(u)
    setFormData({
      name: u.name,
      email: u.email,
      role: u.role,
      birim_id: u.birim_id,
      sube_id: u.sube_id,
      password: '' // Don't set password when editing
    })
    setShowModal(true)
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`"${u.name}" silinecek. Emin misiniz?`)) return

    try {
      await kullanicilarApi.delete(u.id)
      setUsers(users.filter(x => x.id !== u.id))
    } catch (err: any) {
      alert('Silinemedi: ' + (err.message || 'Bilinmeyen hata'))
    }
  }

  const openParolaSifirla = (u: User) => {
    setParolaTarget(u)
    setYeniParola('')
    setParolaError('')
    setParolaBasarili('')
  }

  const handleParolaSifirla = async () => {
    if (!parolaTarget) return
    if (yeniParola.length < 8) { setParolaError('Parola en az 8 karakter olmalıdır.'); return }

    setParolaSaving(true)
    setParolaError('')
    try {
      await kullanicilarApi.update(parolaTarget.id, { password: yeniParola })
      setParolaBasarili(`${parolaTarget.name} için yeni parola belirlendi. Kullanıcının açık oturumları kapatıldı.`)
      setYeniParola('')
    } catch (err: any) {
      setParolaError(err?.errors?.password?.[0] ?? err?.message ?? 'Parola değiştirilemedi.')
    } finally {
      setParolaSaving(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.role) return alert('Lütfen zorunlu alanları doldurun.')
    if (formData.role === 'birim_yoneticisi' && !formData.birim_id) return alert('Birim yöneticisi için birim seçilmelidir.')
    if (formData.role === 'sube_yoneticisi' && !formData.sube_id) return alert('Şube yöneticisi için şube seçilmelidir.')

    setSaving(true)
    try {
      if (editingUser) {
        const payload = { ...formData }
        if (!payload.password) delete payload.password // Don't send empty password
        const updated = await kullanicilarApi.update(editingUser.id, payload)
        setUsers(users.map(u => u.id === editingUser.id ? updated : u))
      } else {
        if (!formData.password) return alert('Yeni kullanıcı için parola gereklidir.')
        const created = await kullanicilarApi.create(formData as any)
        setUsers([created, ...users])
      }
      setShowModal(false)
    } catch (err: any) {
      let msg = err.message || 'Kaydedilemedi'
      if (err.errors) {
        msg = Object.values(err.errors).flat().join('\n')
      }
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  const { page, totalPages, pageItems, nextPage, prevPage, setPage } = usePagination(filtered, SAYFA_BOYUTU)

  const handleSearch = (deger: string) => {
    setSearch(deger)
    setPage(1)
  }

  const columns: DataTableColumn<User>[] = [
    {
      header: 'Kullanıcı',
      render: u => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: roleColor[u.role] || '#9CA3AF' }}>
            {u.initials}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{u.name}</p>
            <p className="text-xs text-gray-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Rol',
      render: u => (
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: `${roleColor[u.role] || '#9CA3AF'}15`, color: roleColor[u.role] || '#9CA3AF' }}>
          {u.roleLabel}
        </span>
      ),
    },
    { header: 'Birim', cellClassName: 'px-4 py-4 text-sm text-gray-600', render: u => u.birim_adi || '—' },
    { header: 'Şube', cellClassName: 'px-4 py-4 text-sm text-gray-600', render: u => u.sube_adi || '—' },
    {
      header: '',
      headerClassName: 'px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-20',
      render: (u) => (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleOpenEdit(u)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><Edit2 size={14} /></button>
          <button onClick={() => openParolaSifirla(u)} title="Parolayı sıfırla"
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><KeyRound size={14} /></button>
          <button onClick={() => handleDelete(u)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader title="Kullanıcılar" subtitle={`${users.length} kullanıcı kayıtlı`}
        actions={<Btn variant="primary" onClick={handleOpenAdd}><Plus size={14} />Kullanıcı Ekle</Btn>} />

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
      )}

      <Card>
        <div className="p-4 border-b border-gray-50">
          <SearchBar placeholder="Kullanıcı ara..." value={search} onChange={handleSearch} />
        </div>
        {loading ? (
          <Loading />
        ) : (
          <>
            <DataTable columns={columns} data={pageItems} keyExtractor={u => u.id} />
            <Pagination page={page} totalPages={totalPages} toplam={filtered.length} pageSize={SAYFA_BOYUTU}
              onPrev={prevPage} onNext={nextPage} onPage={setPage} birim="kullanıcı" />
          </>
        )}
      </Card>

      {showModal && (
        <Modal title={editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı Ekle"} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <KullaniciFormFields data={formData} onChange={setFormData} birimler={birimler} subeler={subeler} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setShowModal(false)}>İptal</Btn>
              <Btn variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {parolaTarget && (
        <Modal title="Parolayı Sıfırla" onClose={() => setParolaTarget(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{parolaTarget.name}</p>
              <p className="text-xs text-gray-400">{parolaTarget.email}</p>
            </div>

            {parolaBasarili ? (
              <>
                <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
                  {parolaBasarili}
                </div>
                <p className="text-xs text-gray-400">
                  Yeni parolayı kullanıcıya kendiniz iletmelisiniz — sistem e-posta göndermiyor.
                </p>
                <div className="flex items-center justify-end pt-2">
                  <Btn variant="primary" onClick={() => setParolaTarget(null)}>Kapat</Btn>
                </div>
              </>
            ) : (
              <>
                <FormField label="Yeni Parola">
                  <input type="text" className={inputCls} placeholder="En az 8 karakter"
                    value={yeniParola} onChange={e => setYeniParola(e.target.value)} autoFocus />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Parolayı kullanıcıya iletebilmeniz için açık gösteriliyor. Kaydedince kullanıcının
                    açık oturumları kapanır.
                  </p>
                </FormField>

                {parolaError && <p className="text-xs text-red-500">{parolaError}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Btn variant="secondary" onClick={() => setParolaTarget(null)}>İptal</Btn>
                  <Btn variant="primary" onClick={handleParolaSifirla} disabled={parolaSaving || yeniParola.length < 8}>
                    {parolaSaving ? 'Kaydediliyor...' : 'Parolayı Değiştir'}
                  </Btn>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
