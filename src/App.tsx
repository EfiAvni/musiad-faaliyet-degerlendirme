import { useState, useRef, useEffect } from 'react'
import { subelerApi } from '@/services/subeService'
import type { Sube as ApiSube, PuanOzeti } from '@/types/sube'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem, PeriyotTipi } from '@/types/donem'
import { faaliyetlerApi } from '@/services/faaliyetService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import { faaliyetKayitlariApi } from '@/services/faaliyetKayitService'
import type { FaaliyetKayit as ApiFaaliyetKayit } from '@/types/faaliyetKayit'
import { raporlarApi } from '@/services/raporService'
import type { DonemRaporu } from '@/types/rapor'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { useModal } from '@/hooks/useModal'
import {
  Building2, Users, Calendar, ClipboardList,
  Search, ChevronRight, ChevronLeft,
  Plus, Edit2, Trash2, CheckCircle,
  Download, Upload, Target, FileCheck,
  ChevronUp, ChevronDown, ArrowUpDown, PlayCircle, ListChecks,
  Archive, BarChart3, Trophy, Loader2
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

import type { User } from '@/types/auth'
import type { RaporTab } from '@/types/rapor'
import type { Page } from '@/types/navigation'
import {
  statusConfig, inputCls,
  RAPOR_RENK, PERIYOT_TIPI_LABEL, PERIYOT_TIPI_SIRALAMA, PERIYOT_TIPI_VARSAYILAN_TAB,
  pageLabels,
} from '@/utils/constants'
import { raporTabClass } from '@/utils/helpers'
import { formatTarihKisa, formatTarihUzun, formatPercent } from '@/utils/formatters'

// ─── UI Primitifleri ───────────────────────────────────────────────────────────

import { StatusBadge } from '@/components/common/StatusBadge'
import { Card } from '@/components/common/Card'
import { KpiCard } from '@/components/common/KpiCard'
import { PageHeader } from '@/components/common/PageHeader'
import { Btn } from '@/components/common/Btn'
import { SearchBar } from '@/components/common/SearchBar'
import { Modal, ConfirmModal } from '@/components/common/Modal'
import { FormField } from '@/components/common/FormField'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { PlaceholderPage } from '@/components/common/PlaceholderPage'

// ─── Sidebar ───────────────────────────────────────────────────────────────────

import { Sidebar } from '@/components/layout/Sidebar'

// ─── Header ────────────────────────────────────────────────────────────────────

import { TopHeader } from '@/components/layout/Header'

// ─── Login Sayfası ─────────────────────────────────────────────────────────────

import { LoginPage } from '@/pages/Login/Login'

// ─── Süper Admin Sayfaları ─────────────────────────────────────────────────────

import { SuperAdminDashboard } from '@/pages/Dashboard/SuperAdminDashboard'

import { BirimlerPage } from '@/pages/Birimler/Birimler'

import { KullanicilarPage } from '@/pages/Kullanicilar/Kullanicilar'

// ─── Birim Yöneticisi Sayfaları ────────────────────────────────────────────────

import { BirimYoneticisiDashboard } from '@/pages/Dashboard/BirimYoneticisiDashboard'

function SubelerPage() {
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

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id))

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        filtered.forEach(s => next.delete(s.id))
        return next
      }
      const next = new Set(prev)
      filtered.forEach(s => next.add(s.id))
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
            <SearchBar placeholder="Şube ara..." value={search} onChange={setSearch} />
          )}
          <span className="text-xs text-gray-400">{filtered.length} şube listeleniyor</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={allFilteredSelected} onChange={toggleSelectAll} />
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
              ) : filtered.map(s => (
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
                        {s.birim && <p className="text-xs text-gray-400">{s.birim.name}</p>}
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

import { FaaliyetFormFields } from '@/components/forms/FaaliyetForm'
import { SubeFormFields } from '@/components/forms/SubeForm'

function FaaliyetCard({ f, onEdit, onDelete }: { f: ApiFaaliyet; onEdit: () => void; onDelete: () => void }) {
  const [showKayitlar, setShowKayitlar] = useState(false)
  const [kayitlar, setKayitlar] = useState<ApiFaaliyetKayit[] | null>(null)
  const [loadingKayitlar, setLoadingKayitlar] = useState(false)

  const toggleKayitlar = async () => {
    if (showKayitlar) { setShowKayitlar(false); return }
    setShowKayitlar(true)
    if (kayitlar === null) {
      setLoadingKayitlar(true)
      try {
        setKayitlar(await faaliyetKayitlariApi.list({ faaliyet_id: f.id }))
      } catch { setKayitlar([]) }
      finally { setLoadingKayitlar(false) }
    }
  }

  const formatTarih = formatTarihKisa

  return (
    <Card className="p-5 flex flex-col gap-3 group relative hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#B99C1A15' }}>
            <FileCheck size={16} style={{ color: '#B99C1A' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{f.title}</p>
            <p className="text-xs text-gray-400 truncate">{f.donem?.name ?? '—'}</p>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" onClick={onEdit}>
            <Edit2 size={13} />
          </button>
          <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {f.detay && <p className="text-xs text-gray-500 line-clamp-2">{f.detay}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-medium">
          Puan: <strong className="text-gray-800">{f.puan}</strong>
        </span>
        <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium">
          Hedef: <strong>{f.hedef}</strong> adet
        </span>
        <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
          Maks. Puan: <strong>{f.max_puan}</strong>
        </span>
        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${f.tarih_gerekli ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
          {f.tarih_gerekli ? 'Tarihli' : 'Tarihsiz'}
        </span>
        <StatusBadge status={f.durum} />
      </div>

      {f.aciklama && (
        <p className="text-xs text-gray-400 line-clamp-2 border-t border-gray-50 pt-2">{f.aciklama}</p>
      )}

      <button onClick={toggleKayitlar}
        className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 border-t border-gray-50 pt-3 -mb-1">
        <ListChecks size={12} />
        {showKayitlar ? 'Şube Kayıtlarını Gizle' : 'Şube Kayıtlarını Göster'}
        {kayitlar !== null && ` (${kayitlar.length})`}
      </button>

      {showKayitlar && (
        loadingKayitlar ? (
          <p className="text-xs text-gray-400">Yükleniyor...</p>
        ) : !kayitlar || kayitlar.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Henüz hiçbir şube kayıt girmedi.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {kayitlar.map(k => (
              <div key={k.id} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-gray-700">{k.sube?.name ?? '—'}</p>
                  <p className="text-[11px] text-gray-400">{formatTarih(k.created_at)}</p>
                </div>
                {k.tarih && <p className="text-[11px] text-gray-400 mb-0.5">Tarih: {formatTarih(k.tarih)}</p>}
                <p className="text-xs text-gray-700 font-medium">{k.deger}</p>
                {k.aciklama && <p className="text-xs text-gray-500 mt-0.5">{k.aciklama}</p>}
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  )
}

function FaaliyetlerPage({ initialDonemId }: { initialDonemId: number | null }) {
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

function SubeScopeToggle({ tumSubeler, setTumSubeler }: { tumSubeler: boolean; setTumSubeler: (v: boolean) => void }) {
  return (
    <FormField label="Şube Kapsamı">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setTumSubeler(true)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${tumSubeler ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
          Tüm Şubeler
        </button>
        <button type="button" onClick={() => setTumSubeler(false)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${!tumSubeler ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
          Belirli Şubeler
        </button>
      </div>
    </FormField>
  )
}

function SubeChecklist({ subeIds, setSubeIds, subeler }: {
  subeIds: number[]; setSubeIds: (v: number[]) => void
  subeler: ApiSube[]
}) {
  const [search, setSearch] = useState('')
  const filtered = subeler.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600">Şubeler</label>
        <span className="text-xs text-gray-400">{subeIds.length} seçili</span>
      </div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Şube ara..."
          className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
      </div>
      {subeler.length === 0 ? (
        <p className="text-xs text-gray-400">Henüz şube eklenmedi.</p>
      ) : (
        <div className="flex-1 min-h-[22rem] max-h-[26rem] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 p-3">"{search}" ile eşleşen şube bulunamadı.</p>
          ) : filtered.map(s => (
            <label key={s.id} className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={subeIds.includes(s.id)}
                onChange={() => setSubeIds(subeIds.includes(s.id) ? subeIds.filter(x => x !== s.id) : [...subeIds, s.id])} />
              {s.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function GecmisDonemlerListesi({ items, loading, onSelect, onDelete, formatTarih }: {
  items: ApiDonem[]; loading: boolean
  onSelect: (d: ApiDonem) => void; onDelete: (d: ApiDonem) => void
  formatTarih: (iso: string) => string
}) {
  if (loading) {
    return (
      <Loading />
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={Archive} title="Henüz geçmiş dönem yok" subtitle="Bir dönem tamamlandığında burada arşivlenmiş olarak görünecek." />
    )
  }

  return (
    <div className="grid gap-3">
      {items.map(d => (
        <Card key={d.id} className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => onSelect(d)}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gray-50">
              <Archive size={20} className="text-gray-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{d.name}</h3>
              <p className="text-sm text-gray-400 mt-0.5 truncate">
                {formatTarih(d.start_date)} – {formatTarih(d.end_date)} · {d.faaliyetler_count ?? 0} faaliyet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-500 font-medium"
              title={d.tum_subeler ? undefined : (d.subeler ?? []).map(s => s.name).join(', ')}>
              <Building2 size={12} />
              {d.tum_subeler ? 'Tüm Şubeler' : `${d.subeler?.length ?? 0} Şube`}
            </span>
            <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
              onClick={e => { e.stopPropagation(); onDelete(d) }} title="Sil">
              <Trash2 size={14} />
            </button>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-600 transition-colors" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function GecmisDonemDetay({ donem, onBack, onShowRapor }: { donem: ApiDonem; onBack: () => void; onShowRapor: (donemId: number) => void }) {
  const [detail, setDetail] = useState<ApiDonem | null>(null)
  const [faaliyetler, setFaaliyetler] = useState<ApiFaaliyet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([donemlerApi.show(donem.id), faaliyetlerApi.list(donem.id)])
      .then(([full, faaliyetData]) => {
        if (cancelled) return
        setDetail(full)
        setFaaliyetler(faaliyetData)
      })
      .catch(() => { /* detay yüklenemedi, mevcut özet bilgilerle devam edilir */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [donem.id])

  const formatTarih = formatTarihUzun

  const toplamHedef = faaliyetler.reduce((sum, f) => sum + f.hedef, 0)
  const scope = donem.tum_subeler ? 'Tüm Şubeler' : `${donem.subeler?.length ?? 0} Şube`

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ChevronLeft size={15} />Geçmiş Dönemlere Dön
      </button>

      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gray-50">
              <Archive size={24} className="text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{donem.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{formatTarih(donem.start_date)} – {formatTarih(donem.end_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-medium"
              title={donem.tum_subeler ? undefined : (donem.subeler ?? []).map(s => s.name).join(', ')}>
              <Building2 size={12} />{scope}
            </span>
            <StatusBadge status="completed" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam Faaliyet', value: faaliyetler.length, color: '#B99C1A' },
          { label: 'Toplam Hedef', value: toplamHedef, color: '#f59e0b' },
          { label: 'Değerlendirme Ayı', value: detail?.aylar?.length ?? '—', color: '#2563eb' },
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

      {detail?.aylar && detail.aylar.length > 0 && (
        <Card className="p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Değerlendirme Ayları</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {detail.aylar.map(ay => (
              <div key={ay.id} className="px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-xs font-medium text-gray-600">
                {ay.name}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Faaliyetler</h3>
        {loading ? (
          <Loading />
        ) : faaliyetler.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-400">Bu döneme faaliyet tanımlanmamış.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {faaliyetler.map(f => (
              <Card key={f.id} className="p-4 flex flex-col gap-2">
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                {f.detay && <p className="text-xs text-gray-500">{f.detay}</p>}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-medium">
                    Puan: <strong className="text-gray-800">{f.puan}</strong>
                  </span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-medium">
                    Hedef: <strong>{f.hedef}</strong>
                  </span>
                  <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                    Maks: <strong>{f.max_puan}</strong>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="p-6 text-center">
        <BarChart3 size={22} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm font-medium text-gray-500 mb-1">Detaylı Raporlama</p>
        <p className="text-xs text-gray-400 mb-4">Şube bazlı puan sıralaması, faaliyet doluluk oranları ve aylık kayıt grafikleriyle tam raporu görüntüleyin.</p>
        <Btn variant="primary" onClick={() => onShowRapor(donem.id)}>
          <BarChart3 size={14} />Raporu Görüntüle
        </Btn>
      </Card>
    </div>
  )
}

function DonemlerPage({ onShowFaaliyetler, onShowRapor }: { onShowFaaliyetler: (donemId: number) => void; onShowRapor: (donemId: number) => void }) {
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

// ─── Raporlar ──────────────────────────────────────────────────────────────────

function RaporChartTooltip({ active, payload, label, suffix = '' }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      <p className="text-gray-500">{payload[0].value}{suffix}</p>
    </div>
  )
}

function RaporGenelTab({ rapor }: { rapor: DonemRaporu }) {
  const { genel, aylik_trend } = rapor
  const trendData = aylik_trend.map(a => ({ name: a.ay.split(' ')[0], kayit: a.kayit_sayisi }))
  const tamamlanmaYuzde = formatPercent(genel.ortalama_tamamlanma)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Kapsamdaki Şube', value: genel.toplam_sube, color: '#2563eb' },
          { label: 'Toplam Faaliyet', value: genel.toplam_faaliyet, color: RAPOR_RENK },
          { label: 'Toplam Kayıt', value: genel.toplam_kayit, color: '#059669' },
          { label: 'Toplam Hedef', value: genel.toplam_hedef, color: '#f59e0b' },
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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Ortalama Tamamlanma Oranı</h3>
          <span className="text-sm font-semibold" style={{ color: RAPOR_RENK }}>%{tamamlanmaYuzde}</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: `${RAPOR_RENK}20` }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tamamlanmaYuzde}%`, background: RAPOR_RENK }} />
        </div>
        {genel.en_iyi_sube_adi && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
            <Trophy size={12} style={{ color: RAPOR_RENK }} />
            En yüksek performans: <strong className="text-gray-600 font-medium">{genel.en_iyi_sube_adi}</strong>
            {genel.en_iyi_sube_orani !== null && ` (%${formatPercent(genel.en_iyi_sube_orani)})`}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Aylık Kayıt Dağılımı</h3>
        {trendData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Bu döneme ait değerlendirme ayı bulunmuyor.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="raporTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RAPOR_RENK} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={RAPOR_RENK} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e1e0d9" strokeDasharray="0" />
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<RaporChartTooltip suffix=" kayıt" />} />
              <Area type="monotone" dataKey="kayit" stroke={RAPOR_RENK} strokeWidth={2} fill="url(#raporTrendFill)" dot={{ r: 3, fill: RAPOR_RENK, strokeWidth: 0 }} activeDot={{ r: 5, fill: RAPOR_RENK, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}

function RaporSubeTab({ rapor }: { rapor: DonemRaporu }) {
  const { sube_bazli } = rapor
  const chartData = sube_bazli.slice(0, 10).map(s => ({ name: s.sube_adi, puan: s.toplam_puan }))
  const chartHeight = Math.max(120, chartData.length * 34)

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Şube Sıralaması</h3>
        <p className="text-xs text-gray-400 mb-4">{sube_bazli.length > 10 ? 'İlk 10 şube — tam liste aşağıdaki tabloda' : 'Toplam puana göre sıralı'}</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Bu dönem kapsamında değerlendirilecek şube bulunmuyor.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="#e1e0d9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
              <Tooltip content={<RaporChartTooltip suffix=" puan" />} cursor={{ fill: '#f9f9f7' }} />
              <Bar dataKey="puan" fill={RAPOR_RENK} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Tüm Şubeler</h3>
        </div>
        {sube_bazli.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Şube bulunmuyor.</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Şube</th>
                  <th className="px-5 py-3 font-medium text-right">Kayıt</th>
                  <th className="px-5 py-3 font-medium text-right">Puan</th>
                  <th className="px-5 py-3 font-medium">Tamamlanma</th>
                </tr>
              </thead>
              <tbody>
                {sube_bazli.map((s, i) => (
                  <tr key={s.sube_id} className="border-t border-gray-50">
                    <td className="px-5 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-5 py-2.5 text-gray-800 font-medium">{s.sube_adi}</td>
                    <td className="px-5 py-2.5 text-right text-gray-600">{s.kayit_sayisi}</td>
                    <td className="px-5 py-2.5 text-right text-gray-600">{s.toplam_puan} / {s.max_puan}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: `${RAPOR_RENK}20` }}>
                          <div className="h-full rounded-full" style={{ width: `${formatPercent(s.tamamlanma_orani)}%`, background: RAPOR_RENK }} />
                        </div>
                        <span className="text-xs text-gray-500">%{formatPercent(s.tamamlanma_orani)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function RaporFaaliyetTab({ rapor }: { rapor: DonemRaporu }) {
  const { faaliyet_bazli, genel } = rapor
  const chartData = faaliyet_bazli.slice(0, 10).map(f => ({ name: f.title, kayit: f.toplam_kayit }))
  const chartHeight = Math.max(120, chartData.length * 34)

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Faaliyet Bazlı Kayıt Sayısı</h3>
        <p className="text-xs text-gray-400 mb-4">{faaliyet_bazli.length > 10 ? 'İlk 10 faaliyet — tam liste aşağıdaki tabloda' : 'Toplam kayıt sayısına göre sıralı'}</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Bu döneme tanımlanmış faaliyet bulunmuyor.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="#e1e0d9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
              <Tooltip content={<RaporChartTooltip suffix=" kayıt" />} cursor={{ fill: '#f9f9f7' }} />
              <Bar dataKey="kayit" fill={RAPOR_RENK} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Tüm Faaliyetler</h3>
        </div>
        {faaliyet_bazli.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Faaliyet bulunmuyor.</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Faaliyet</th>
                  <th className="px-5 py-3 font-medium text-right">Puan</th>
                  <th className="px-5 py-3 font-medium text-right">Hedef</th>
                  <th className="px-5 py-3 font-medium text-right">Toplam Kayıt</th>
                  <th className="px-5 py-3 font-medium text-right">Katılan Şube</th>
                  <th className="px-5 py-3 font-medium">Doluluk</th>
                </tr>
              </thead>
              <tbody>
                {faaliyet_bazli.map(f => (
                  <tr key={f.faaliyet_id} className="border-t border-gray-50">
                    <td className="px-5 py-2.5 text-gray-800 font-medium">{f.title}</td>
                    <td className="px-5 py-2.5 text-right text-gray-600">{f.puan}</td>
                    <td className="px-5 py-2.5 text-right text-gray-600">{f.hedef}</td>
                    <td className="px-5 py-2.5 text-right text-gray-600">{f.toplam_kayit}</td>
                    <td className="px-5 py-2.5 text-right text-gray-600">{f.katilan_sube_sayisi} / {genel.toplam_sube}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: `${RAPOR_RENK}20` }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, formatPercent(f.doluluk_orani))}%`, background: RAPOR_RENK }} />
                        </div>
                        <span className="text-xs text-gray-500">%{formatPercent(f.doluluk_orani)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function RaporMatrisTab({ rapor }: { rapor: DonemRaporu }) {
  const { sube_bazli, faaliyet_bazli, sube_faaliyet_matrisi } = rapor
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'sube_adi' | 'toplam_puan' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: 'sube_adi' | 'toplam_puan') => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  if (sube_bazli.length === 0 || faaliyet_bazli.length === 0) {
    return (
      <EmptyState icon={BarChart3} title="Matris için yeterli veri yok" subtitle="Bu dönemde değerlendirilecek şube veya faaliyet bulunmuyor." />
    )
  }

  const hucreMap = new Map<string, { adet: number; doluluk_orani: number }>()
  sube_faaliyet_matrisi.forEach(h => hucreMap.set(`${h.sube_id}_${h.faaliyet_id}`, h))

  const filtered = (() => {
    const arr = sube_bazli.filter(s => s.sube_adi.toLowerCase().includes(search.toLowerCase()))
    if (sortKey) {
      arr.sort((a, b) => {
        const cmp = sortKey === 'sube_adi' ? a.sube_adi.localeCompare(b.sube_adi, 'tr') : a.toplam_puan - b.toplam_puan
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return arr
  })()

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Şube × Faaliyet Matrisi</h3>
          <p className="text-xs text-gray-400 mt-0.5">Her hücre, ilgili şubenin ilgili faaliyetteki kayıt sayısını gösterir</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Şube ara..."
          className={`${inputCls} w-48 py-1.5`}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Aramayla eşleşen şube bulunmuyor.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium sticky left-0 bg-white select-none cursor-pointer hover:text-gray-600 whitespace-nowrap"
                  onClick={() => toggleSort('sube_adi')}>
                  <span className="inline-flex items-center gap-1">
                    Şube
                    {sortKey === 'sube_adi' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} className="text-gray-300" />}
                  </span>
                </th>
                {faaliyet_bazli.map(f => (
                  <th key={f.faaliyet_id} className="px-3 py-3 font-medium text-center whitespace-nowrap" title={f.title}>
                    {f.title.length > 14 ? f.title.slice(0, 14) + '…' : f.title}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-right select-none cursor-pointer hover:text-gray-600 whitespace-nowrap"
                  onClick={() => toggleSort('toplam_puan')}>
                  <span className="inline-flex items-center gap-1 justify-end">
                    Toplam Puan
                    {sortKey === 'toplam_puan' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} className="text-gray-300" />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.sube_id} className="border-t border-gray-50">
                  <td className="px-4 py-2.5 text-gray-800 font-medium sticky left-0 bg-white whitespace-nowrap">{s.sube_adi}</td>
                  {faaliyet_bazli.map(f => {
                    const hucre = hucreMap.get(`${s.sube_id}_${f.faaliyet_id}`)
                    const doluluk = hucre?.doluluk_orani ?? 0
                    const alpha = doluluk > 0 ? Math.round(24 + Math.min(doluluk, 1) * 56).toString(16).padStart(2, '0') : null
                    return (
                      <td key={f.faaliyet_id} className="px-3 py-2.5 text-center">
                        <span
                          className="inline-flex items-center justify-center min-w-[2rem] h-6 px-1.5 rounded-md text-xs font-medium"
                          style={{
                            background: alpha ? `${RAPOR_RENK}${alpha}` : 'transparent',
                            color: doluluk >= 0.5 ? '#5c4a0e' : '#9c9a92',
                          }}
                        >
                          {hucre?.adet ?? 0}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-2.5 text-right text-gray-600 font-medium">{s.toplam_puan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function RaporlarPage({ initialDonemId }: { initialDonemId: number | null }) {
  const [donemler, setDonemler] = useState<ApiDonem[]>([])
  const [selectedDonemId, setSelectedDonemId] = useState<number | null>(initialDonemId)
  const [rapor, setRapor] = useState<DonemRaporu | null>(null)
  const [loadingDonemler, setLoadingDonemler] = useState(true)
  const [loadingRapor, setLoadingRapor] = useState(false)
  const [apiError, setApiError] = useState('')
  const [tab, setTab] = useState<RaporTab>('genel')
  const [indiriliyor, setIndiriliyor] = useState(false)
  const [periyotFiltre, setPeriyotFiltre] = useState<PeriyotTipi | 'all'>('all')
  const varsayilanTabUygulandi = useRef<number | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const data = await donemlerApi.list()
        const raporlanabilir = data.filter(d => d.status !== 'pending')
        setDonemler(raporlanabilir)
        setSelectedDonemId(prev => {
          if (prev !== null) return prev
          const ilk = raporlanabilir.find(d => d.status === 'active') ?? raporlanabilir[0]
          return ilk?.id ?? null
        })
      } catch {
        setApiError('Dönemler yüklenemedi. Backend bağlantısını kontrol edin.')
      } finally {
        setLoadingDonemler(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (selectedDonemId === null) { setRapor(null); return }
    setLoadingRapor(true)
    raporlarApi.donemRaporu(selectedDonemId)
      .then(data => { setRapor(data); setApiError('') })
      .catch(() => setApiError('Rapor yüklenemedi. Backend bağlantısını kontrol edin.'))
      .finally(() => setLoadingRapor(false))
  }, [selectedDonemId])

  useEffect(() => {
    if (rapor && varsayilanTabUygulandi.current !== rapor.donem.id) {
      setTab(PERIYOT_TIPI_VARSAYILAN_TAB[rapor.donem.periyot_tipi])
      varsayilanTabUygulandi.current = rapor.donem.id
    }
  }, [rapor])

  const filtrelenmisDonemler = periyotFiltre === 'all' ? donemler : donemler.filter(d => d.periyot_tipi === periyotFiltre)

  useEffect(() => {
    if (selectedDonemId !== null && !filtrelenmisDonemler.some(d => d.id === selectedDonemId)) {
      setSelectedDonemId(filtrelenmisDonemler[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periyotFiltre])

  const handleIndir = async () => {
    if (!selectedDonemId || !rapor) return
    setIndiriliyor(true)
    try {
      await raporlarApi.indirPdf(selectedDonemId, `MUSIAD-${rapor.donem.name.replace(/\s+/g, '-')}-raporu.pdf`)
    } catch {
      setApiError('PDF oluşturulamadı. Backend bağlantısını kontrol edin.')
    } finally {
      setIndiriliyor(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Raporlar" subtitle="Dönem bazlı performans raporları — şube, faaliyet ve zaman kırılımında"
        actions={
          <Btn variant="primary" onClick={handleIndir} disabled={!rapor || indiriliyor}>
            {indiriliyor ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {indiriliyor ? 'Hazırlanıyor...' : 'PDF İndir'}
          </Btn>
        } />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <div className="mb-6 flex items-end gap-4 flex-wrap">
        <div className="w-56">
          <FormField label="Rapor Dönemi Türü">
            <select className={inputCls} value={periyotFiltre}
              onChange={e => setPeriyotFiltre(e.target.value as PeriyotTipi | 'all')}>
              <option value="all">Tümü</option>
              {PERIYOT_TIPI_SIRALAMA.map(tip => (
                <option key={tip} value={tip}>{PERIYOT_TIPI_LABEL[tip]}</option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="w-72">
          <FormField label="Dönem">
            <select className={inputCls} value={selectedDonemId ?? ''}
              onChange={e => setSelectedDonemId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Dönem seçin...</option>
              {filtrelenmisDonemler.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.status === 'active' ? ' (Aktif)' : ' (Tamamlandı)'}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {loadingDonemler ? (
        <Loading />
      ) : donemler.length === 0 ? (
        <EmptyState icon={BarChart3} title="Rapor için uygun dönem yok" subtitle="Bir dönemi aktif ettiğinizde veya tamamladığınızda burada raporlanabilir." />
      ) : filtrelenmisDonemler.length === 0 ? (
        <EmptyState icon={BarChart3} title="Bu dönem türünde rapor bulunmuyor" subtitle='Farklı bir dönem türü seçin veya "Tümü" seçeneğine dönün.' />
      ) : !selectedDonemId || loadingRapor || !rapor ? (
        <Loading />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-gray-50 rounded-xl">
              <button onClick={() => setTab('genel')} className={raporTabClass(tab === 'genel')}>Genel Özet</button>
              <button onClick={() => setTab('sube')} className={raporTabClass(tab === 'sube')}>Şube Bazlı</button>
              <button onClick={() => setTab('faaliyet')} className={raporTabClass(tab === 'faaliyet')}>Faaliyet Bazlı</button>
              <button onClick={() => setTab('matris')} className={raporTabClass(tab === 'matris')}>Matris</button>
            </div>
            <span className="text-xs text-gray-400 px-1">
              {PERIYOT_TIPI_LABEL[rapor.donem.periyot_tipi]} dönem
            </span>
          </div>

          {tab === 'genel' && <RaporGenelTab rapor={rapor} />}
          {tab === 'sube' && <RaporSubeTab rapor={rapor} />}
          {tab === 'faaliyet' && <RaporFaaliyetTab rapor={rapor} />}
          {tab === 'matris' && <RaporMatrisTab rapor={rapor} />}
        </>
      )}
    </div>
  )
}

// ─── Şube Yöneticisi Sayfaları ─────────────────────────────────────────────────

function SubeYoneticisiDashboard({ onNavigate, user }: { onNavigate: (p: Page) => void; user: User }) {
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
  const donemSubtitle = activeDonemler.length === 0
    ? 'Aktif dönem yok'
    : activeDonemler.length === 1
      ? `Aktif dönem: ${activeDonemler[0].name}`
      : `Aktif dönemler: ${activeDonemler.map(d => d.name).join(', ')}`

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
          Hoş geldiniz, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.sube} — {donemSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="Toplam Faaliyet" value={`${toplam}`}          change="0" changeType="neutral" icon={ClipboardList} color="#B99C1A" />
        <KpiCard label="Kayıt Girilen"    value={`${kapsananSayisi}`}  change="0" changeType="neutral" icon={CheckCircle}  color="#a38817" />
        <KpiCard label="Kapsanma Oranı"   value={`%${pct}`}            change={pct >= 75 ? 'İyi' : 'Devam ediyor'} changeType={pct >= 75 ? 'up' : 'neutral'} icon={Target} color="#2563eb" />
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-sm" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Genel İlerleme</h3>
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
                  {f.detay && <p className="text-xs text-gray-400 truncate">{f.detay}</p>}
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

function FaaliyetlerimPage() {
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

  const loadDonemData = async (donemId: number) => {
    try {
      const [full, faaliyetData, kayitData] = await Promise.all([
        donemlerApi.show(donemId),
        faaliyetlerApi.list(donemId),
        faaliyetKayitlariApi.list(),
      ])
      setAylar(full.aylar ?? [])
      setFaaliyetler(faaliyetData)
      setKayitlar(kayitData)
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

  const acikAy = (aylar ?? []).find(a => a.acik)
  const kayitlarByFaaliyet = (faaliyetId: number) => kayitlar.filter(k => k.faaliyet_id === faaliyetId)

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
        subtitle={activeDonem ? `${activeDonem.name}${acikAy ? ` · ${acikAy.name} için giriş açık` : ' · Açık değerlendirme ayı yok'}` : 'Aktif dönem yok'} />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      {activeDonemler.length > 1 && (
        <div className="mb-4 w-64">
          <FormField label="Dönem">
            <select className={inputCls} value={selectedDonemId ?? ''}
              onChange={e => handleDonemChange(e.target.value ? Number(e.target.value) : null)}>
              {activeDonemler.map(d => (
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
                      {k.donem_ay?.acik && (
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

                <Btn variant="secondary" size="sm" onClick={() => openCreate(f)} disabled={!acikAy}>
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
    </div>
  )
}

// ─── App Shell ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>('login')
  const { currentUser, authChecked, login: handleLogin, logout: handleLogout } = useAuth(setPage)
  const { isSuperAdmin, isBirimYoneticisi } = usePermissions(currentUser)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [faaliyetlerInitialDonemId, setFaaliyetlerInitialDonemId] = useState<number | null>(null)
  const [raporlarInitialDonemId, setRaporlarInitialDonemId] = useState<number | null>(null)

  const handleNavigate = (p: Page) => {
    setFaaliyetlerInitialDonemId(null)
    setRaporlarInitialDonemId(null)
    setPage(p)
  }

  const openFaaliyetlerForDonem = (donemId: number) => {
    setFaaliyetlerInitialDonemId(donemId)
    setPage('faaliyetler')
  }

  const openRaporForDonem = (donemId: number) => {
    setRaporlarInitialDonemId(donemId)
    setPage('raporlar')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F6F8FA' }}>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid #e5e7eb', borderTopColor: '#B99C1A' }} />
          Oturum doğrulanıyor...
        </div>
      </div>
    )
  }

  if (!currentUser) return <LoginPage onLogin={handleLogin} />

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        if (isSuperAdmin)       return <SuperAdminDashboard onNavigate={handleNavigate} />
        if (isBirimYoneticisi) return <BirimYoneticisiDashboard onNavigate={handleNavigate} user={currentUser} />
        return <SubeYoneticisiDashboard onNavigate={handleNavigate} user={currentUser} />
      case 'birimler':      return <BirimlerPage />
      case 'kullanicilar':  return <KullanicilarPage />
      case 'roller':        return <PlaceholderPage title="Rol & Yetkiler"  subtitle="Roller ve yetki yönetimi" />
      case 'ayarlar':       return <PlaceholderPage title="Genel Ayarlar"   subtitle="Sistem ayarları" />
      case 'subeler':       return <SubelerPage />
      case 'faaliyetler':   return <FaaliyetlerPage initialDonemId={faaliyetlerInitialDonemId} />
      case 'donemler':      return <DonemlerPage onShowFaaliyetler={openFaaliyetlerForDonem} onShowRapor={openRaporForDonem} />
      case 'faaliyetlerim': return <FaaliyetlerimPage />
      case 'raporlar':      return <RaporlarPage initialDonemId={raporlarInitialDonemId} />
      default:              return null
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar current={page} onNavigate={handleNavigate} collapsed={sidebarCollapsed} user={currentUser} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader onToggleSidebar={() => setSidebarCollapsed(p => !p)} currentPageLabel={pageLabels[page] || ''} user={currentUser} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
