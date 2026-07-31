import { useState } from 'react'
import { BarChart3, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import type { DonemRaporu } from '@/types/rapor'
import { RAPOR_RENK, inputCls } from '@/utils/constants'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'

export function RaporMatrisTab({ rapor }: { rapor: DonemRaporu }) {
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
