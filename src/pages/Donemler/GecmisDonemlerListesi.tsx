import { Archive, Building2, Trash2, ChevronRight } from 'lucide-react'
import type { Donem as ApiDonem } from '@/types/donem'
import { Card } from '@/components/common/Card'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'

export function GecmisDonemlerListesi({ items, loading, onSelect, onDelete, formatTarih }: {
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
