import { useState } from 'react'
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react'
import type { User } from '@/types/auth'
import { roleColor } from '@/utils/constants'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { SearchBar } from '@/components/common/SearchBar'
import { Modal } from '@/components/common/Modal'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { KullaniciFormFields } from '@/components/forms/KullaniciForm'

const columns: DataTableColumn<User>[] = [
  {
    header: 'Kullanıcı',
    render: u => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: roleColor[u.role] }}>
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
        style={{ background: `${roleColor[u.role]}15`, color: roleColor[u.role] }}>
        {u.roleLabel}
      </span>
    ),
  },
  { header: 'Birim', cellClassName: 'px-4 py-4 text-sm text-gray-600', render: u => u.birim_adi || '—' },
  { header: 'Şube', cellClassName: 'px-4 py-4 text-sm text-gray-600', render: u => u.sube_adi || '—' },
  {
    header: '',
    headerClassName: 'px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-20',
    render: () => (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><Edit2 size={14} /></button>
        <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
      </div>
    ),
  },
]

export function KullanicilarPage() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Kullanıcı API'si henüz yazılmadı. Sabit bir kullanıcı listesi göstermek
  // yerine boş durum gösteriyoruz - sahte veri gerçek sanılabiliyordu.
  const users: User[] = []
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="animate-fade-in">
      <PageHeader title="Kullanıcılar" subtitle={`${users.length} kullanıcı kayıtlı`}
        actions={<Btn variant="primary" onClick={() => setShowModal(true)}><Plus size={14} />Kullanıcı Ekle</Btn>} />

      {users.length === 0 ? (
        <EmptyState icon={UserCog} title="Kullanıcı yönetimi henüz kullanıma açılmadı"
          subtitle="Kullanıcılar şimdilik doğrudan veritabanından ekleniyor." />
      ) : (
        <Card>
          <div className="p-4 border-b border-gray-50">
            <SearchBar placeholder="Kullanıcı ara..." value={search} onChange={setSearch} />
          </div>
          <DataTable columns={columns} data={filtered} keyExtractor={u => u.id} />
        </Card>
      )}

      {showModal && (
        <Modal title="Yeni Kullanıcı Ekle" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <KullaniciFormFields />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setShowModal(false)}>İptal</Btn>
              <Btn variant="primary" onClick={() => setShowModal(false)}>Kaydet</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
