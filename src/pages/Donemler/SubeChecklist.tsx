import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Sube as ApiSube } from '@/types/sube'

export function SubeChecklist({ subeIds, setSubeIds, subeler }: {
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
