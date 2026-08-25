import { useState, useRef, useEffect } from 'react'
import {
  Upload, Download, Plus, Trash2, Edit2, Target, Users,
  ChevronUp, ChevronDown, ArrowUpDown,
} from 'lucide-react'
import { subelerApi } from '@/services/subeService'
import type { Sube as ApiSube, PuanOzeti } from '@/types/sube'
import { useModal } from '@/hooks/useModal'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/common/Pagination'
import { statusConfig } from '@/utils/constants'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Btn } from '@/components/common/Btn'
import { SearchBar } from '@/components/common/SearchBar'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Modal, ConfirmModal } from '@/components/common/Modal'
import { SubeFormFields } from '@/components/forms/SubeForm'

const SAYFA_BOYUTU = 20

export function SubelerPage() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ApiSube[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUye, setNewUye] = useState('')
  const [saving, setSaving] = useState(false)

  const [editItem, setEditItem] = useState<ApiSube | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUye, setEditUye] = useState('')
  const [editStatus, setEditStatus] = useState<'active' | 'passive'>('active')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: string[]; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { target: deleteTarget, setTarget: setDeleteTarget, loading: deleting, setLoading: setDeleting } = useModal<ApiSube>()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [sortKey, setSortKey] = useState<'name' | 'uye_sayisi' | 'status' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [puanTarget, setPuanTarget] = useState<ApiSube | null>(null)
  const [puanOzeti, setPuanOzeti] = useState<PuanOzeti | null>(null)
  const [puanLoading, setPuanLoading] = useState(false)

  const openPuanOzeti = async (s: ApiSube) => {
    setPuanTarget(s)
    setPuanOzeti(null)
    setPuanLoading(true)
    try {
      setPuanOzeti(await subelerApi.puanOzeti(s.id))
    } catch { /* puan özeti yüklenemedi */ }
    finally { setPuanLoading(false) }
  }

  const toggleSort = (key: 'name' | 'uye_sayisi' | 'status') => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const loadSubeler = async () => {
    try {
      const data = await subelerApi.list()
      setItems(data)
      setApiError('')
    } catch {
      setApiError('Şubeler yüklenemedi. Backend bağlantısını kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSubeler() }, [])

  const searched = items.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  const filtered = (() => {
    const arr = [...searched]
    if (sortKey) {
      arr.sort((a, b) => {
        let cmp = 0
        if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'tr')
        else if (sortKey === 'uye_sayisi') cmp = a.uye_sayisi - b.uye_sayisi
        else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    if (arr.length > 1) {
      let topIdx = 0
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].uye_sayisi > arr[topIdx].uye_sayisi) topIdx = i
      }
      if (topIdx !== 0) {
        const [top] = arr.splice(topIdx, 1)
        arr.unshift(top)
      }
    }
    return arr
  })()

  const { page, totalPages, pageItems, nextPage, prevPage, setPage } = usePagination(filtered, SAYFA_BOYUTU)

  const handleSearch = (deger: string) => {
    setSearch(deger)
    setPage(1)
  }

  const exportToExcel = () => {
    const bom = '﻿'
    const headers = ['Şube Adı', 'Toplam Üye Sayısı', 'Durum']
    const rows = items.map(s => [s.name, s.uye_sayisi, statusConfig[s.status]?.label || s.status])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\r\n')
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'subeler.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await subelerApi.create({ name: newName.trim(), uye_sayisi: parseInt(newUye) || 0 })
      await loadSubeler()
      setShowModal(false); setNewName(''); setNewUye('')
    } catch { /* validation errors silently ignored for now */ }
    finally { setSaving(false) }
  }

  const openEdit = (s: ApiSube) => {
    setEditItem(s)
    setEditName(s.name)
    setEditUye(String(s.uye_sayisi))
    setEditStatus(s.status)
    setEditError('')
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditItem(null)
    setEditError('')
  }

  const handleUpdate = async () => {
    if (!editItem || !editName.trim()) { setEditError('Şube adı zorunludur.'); return }
    setEditSaving(true); setEditError('')
    try {
      await subelerApi.update(editItem.id, {
        name: editName.trim(),
        uye_sayisi: parseInt(editUye) || 0,
        status: editStatus,
      })
      await loadSubeler()
      closeEditModal()
    } catch (e: any) {
      setEditError(e?.message ?? 'Güncelleme sırasında hata oluştu.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await subelerApi.destroy(deleteTarget.id)
      await loadSubeler()
      setSelectedIds(prev => { const next = new Set(prev); next.delete(deleteTarget.id); return next })
      setDeleteTarget(null)
    } catch {
      // API hatası — liste sunucudan yeniden yüklenir, kayıt kalır
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Başlıktaki onay kutusu yalnızca görünen sayfayı kapsar. Toplu silme yıkıcı
  // bir işlem olduğu için, kullanıcının o an göremediği yüzlerce satırı da
  // seçmesi beklenmedik sonuç doğurur.
  const allPageSelected = pageItems.length > 0 && pageItems.every(s => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageItems.forEach(s => next.delete(s.id))
      } else {
        pageItems.forEach(s => next.add(s.id))
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      await Promise.all(Array.from(selectedIds).map(id => subelerApi.destroy(id)))
      await loadSubeler()
      setSelectedIds(new Set())
      setShowBulkConfirm(false)
    } catch {
      await loadSubeler()
    } finally {
      setBulkDeleting(false)
    }
  }

  const parseAndImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()

    const sendToApi = async (rows: string[][]) => {
      const items = rows.slice(1)
        .map(cols => ({
          name: (cols[0] || '').replace(/^"+|"+$/g, '').trim(),
          uye_sayisi: parseInt((cols[6] || '').replace(/^"+|"+$/g, '').trim()) || 0,
        }))
        .filter(i => i.name)

      if (!items.length) {
        setImportResult({ created: 0, skipped: [], message: 'Dosyada geçerli şube verisi bulunamadı.' })
        return
      }
      const result = await subelerApi.import(items)
      await loadSubeler()
      setImportResult(result)
    }

    if (ext === 'csv') {
      const text = await file.text()
      const rows = text.split(/\r?\n/).filter(l => l.trim()).map(line => {
        const delim = line.indexOf(';') !== -1 ? ';' : ','
        return line.split(delim)
      })
      await sendToApi(rows)
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).XLSX) { resolve(); return }
          const s = document.createElement('script')
          s.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js'
          s.onload = () => resolve(); s.onerror = () => reject()
          document.head.appendChild(s)
        })
        const XLSX = (window as any).XLSX
        const wb = XLSX.read(await file.arrayBuffer())
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        await sendToApi(data)
      } catch {
        setImportResult({ created: 0, skipped: [], message: 'Excel dosyası okunamadı. CSV olarak kaydedin ve tekrar deneyin.' })
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setShowImportModal(true)
    await parseAndImport(file)
    e.target.value = ''
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Şubeler" subtitle={`${items.length} şube kayıtlı`}
        actions={
          <>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileChange} />
            <Btn variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />Şubeleri İçe Aktar
            </Btn>
            <Btn variant="secondary" onClick={exportToExcel}>
              <Download size={14} />Excel'e Aktar
            </Btn>
            <Btn variant="primary" onClick={() => setShowModal(true)}>
              <Plus size={14} />Şube Ekle
            </Btn>
          </>
        }
      />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <Card>
        <div className="flex items-center justify-between p-4 border-b border-gray-50">
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">{selectedIds.size} şube seçildi</span>
              <Btn variant="danger" size="sm" onClick={() => setShowBulkConfirm(true)}>
                <Trash2 size={13} />Seçilenleri Sil
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Seçimi Temizle</Btn>
            </div>
          ) : (
            <SearchBar placeholder="Şube ara..." value={search} onChange={handleSearch} />
          )}
          <span className="text-xs text-gray-400">{filtered.length} şube listeleniyor</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded border-gray-300"
                    title="Bu sayfadaki şubeleri seç"
                    checked={allPageSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide select-none cursor-pointer hover:text-gray-600"
                  onClick={() => toggleSort('name')}>
                  <span className="inline-flex items-center gap-1">
                    Şube Adı
                    {sortKey === 'name' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} className="text-gray-300" />}
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide select-none cursor-pointer hover:text-gray-600"
                  onClick={() => toggleSort('uye_sayisi')}>
                  <span className="inline-flex items-center gap-1">
                    Toplam Üye Sayısı
                    {sortKey === 'uye_sayisi' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} className="text-gray-300" />}
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Faaliyet İlerlemesi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide select-none cursor-pointer hover:text-gray-600"
                  onClick={() => toggleSort('status')}>
                  <span className="inline-flex items-center gap-1">
                    Durum
                    {sortKey === 'status' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} className="text-gray-300" />}
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide w-20" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                    Yükleniyor...
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  {search ? 'Arama sonucu bulunamadı' : 'Henüz şube eklenmedi'}
                </td></tr>
              ) : pageItems.map(s => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/60 group ${selectedIds.has(s.id) ? 'bg-emerald-50/40' : ''}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#2563eb' }}>
                        {s.name.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{s.uye_sayisi.toLocaleString('tr-TR')}</span>
                      <span className="text-xs text-gray-400">üye</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-400 italic">Dönem atanmadı</span>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors" title="Puan Özeti"
                        onClick={() => openPuanOzeti(s)}>
                        <Target size={14} />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                        onClick={() => openEdit(s)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => setDeleteTarget(s)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} toplam={filtered.length} pageSize={SAYFA_BOYUTU}
          onPrev={prevPage} onNext={nextPage} onPage={setPage} birim="şube" />
      </Card>

      {deleteTarget && (
        <ConfirmModal
          title="Şubeyi Sil"
          message={`"${deleteTarget.name}" şubesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      {showBulkConfirm && (
        <ConfirmModal
          title="Seçilen Şubeleri Sil"
          message={`${selectedIds.size} şubeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          confirmLabel="Tümünü Sil"
          onCancel={() => setShowBulkConfirm(false)}
          onConfirm={handleBulkDelete}
          loading={bulkDeleting}
        />
      )}

      {showModal && (
        <Modal title="Yeni Şube Ekle" onClose={() => { setShowModal(false); setNewName(''); setNewUye('') }}>
          <div className="space-y-4">
            <SubeFormFields name={newName} setName={setNewName} uyeSayisi={newUye} setUyeSayisi={setNewUye} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={() => { setShowModal(false); setNewName(''); setNewUye('') }}>İptal</Btn>
              <Btn variant="primary" onClick={handleCreate} disabled={saving || !newName.trim()}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {showEditModal && editItem && (
        <Modal title="Şubeyi Düzenle" onClose={closeEditModal}>
          <div className="space-y-4">
            <SubeFormFields name={editName} setName={setEditName} uyeSayisi={editUye} setUyeSayisi={setEditUye}
              durum={editStatus} setDurum={setEditStatus} error={editError} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Btn variant="secondary" onClick={closeEditModal}>İptal</Btn>
              <Btn variant="primary" onClick={handleUpdate} disabled={editSaving || !editName.trim()}>
                {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal title="Şubeleri İçe Aktar" onClose={() => { setShowImportModal(false); setImportResult(null) }}>
          {!importResult ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-10 h-10 border-[3px] border-gray-100 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-600">Excel dosyası işleniyor...</p>
              <p className="text-xs text-gray-400 mt-1">1. ve 7. sütunlar okunuyor, veritabanına kaydediliyor</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${importResult.created > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <p className={`text-sm font-semibold ${importResult.created > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {importResult.message}
                </p>
                {importResult.skipped.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1">Atlananlar: {importResult.skipped.join(', ')}</p>
                )}
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-700">Bilgi:</strong> Şube adı 1. sütundan, aktif üye sayısı 7. sütundan alınmıştır.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Btn variant="secondary" onClick={() => { setShowImportModal(false); setImportResult(null) }}>Kapat</Btn>
                {importResult.created > 0 && (
                  <Btn variant="primary" onClick={() => { setShowImportModal(false); setImportResult(null) }}>Tamam</Btn>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {puanTarget && (
        <Modal title={`Puan Özeti — ${puanTarget.name}`} onClose={() => setPuanTarget(null)}>
          {puanLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : !puanOzeti || puanOzeti.donem_id === null ? (
            <p className="text-sm text-gray-400 text-center py-6">Aktif bir dönem bulunmadığı için puan hesaplanamadı.</p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-2xl font-semibold text-emerald-700" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{puanOzeti.toplam_puan}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Toplam Puan</p>
              </div>
              {puanOzeti.detaylar.length === 0 ? (
                <p className="text-xs text-gray-400 text-center">Bu döneme ait faaliyet bulunmuyor.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {puanOzeti.detaylar.map(d => (
                    <div key={d.faaliyet_id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-700 truncate">{d.title}</p>
                        <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{d.puan_katkisi} / {d.max_puan}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {d.kayit_sayisi} kayıt · görev başı {d.puan} puan · hedef {d.hedef} adet
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-end pt-4">
            <Btn variant="secondary" onClick={() => setPuanTarget(null)}>Kapat</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
