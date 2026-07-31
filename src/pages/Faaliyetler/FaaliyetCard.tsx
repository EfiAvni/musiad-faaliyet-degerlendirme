import { useState } from 'react'
import { FileCheck, Edit2, Trash2, ListChecks } from 'lucide-react'
import { faaliyetKayitlariApi } from '@/services/faaliyetKayitService'
import type { Faaliyet as ApiFaaliyet } from '@/types/faaliyet'
import type { FaaliyetKayit as ApiFaaliyetKayit } from '@/types/faaliyetKayit'
import { formatTarihKisa } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'

export function FaaliyetCard({ f, onEdit, onDelete }: { f: ApiFaaliyet; onEdit: () => void; onDelete: () => void }) {
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
