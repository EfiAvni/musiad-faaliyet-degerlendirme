import { TrendingDown, TrendingUp } from 'lucide-react'
import type { RaporKategori } from '@/types/rapor'
import { RAPOR_RENK } from '@/utils/constants'
import { formatOranMetni, formatPercent } from '@/utils/formatters'

/**
 * Doküman bölüm 8: "şubenin hangi konularda başarılı, hangi konularda
 * gelişmeye ihtiyacı olduğu görülebilmelidir."
 *
 * Liste backend'den en zayıf kategori başta gelecek şekilde geliyor
 * (KriterKategorileri::kirilim); güçlü yönler sondan okunur.
 */
export function RaporKategoriKirilimi({ kirilim, baslik }: { kirilim: RaporKategori[]; baslik?: string }) {
  const olculebilir = kirilim.filter(k => k.max_puan > 0)

  if (olculebilir.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Kategori kırılımı için puanlanabilir kriter bulunmuyor.</p>
  }

  const enZayif = olculebilir[0]
  const enGuclu = olculebilir[olculebilir.length - 1]
  const tekKategori = olculebilir.length === 1

  return (
    <div className="space-y-4">
      {baslik && (
        <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{baslik}</h3>
      )}

      {/* Tek kategori varsa "en güçlü / en zayıf" ayrımı bilgi taşımaz. */}
      {!tekKategori && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs text-emerald-700 flex items-center gap-1.5 mb-1">
              <TrendingUp size={12} /> Başarılı olduğu konu
            </p>
            <p className="text-sm font-semibold text-emerald-900">{enGuclu.etiket}</p>
            <p className="text-xs text-emerald-600">%{formatOranMetni(enGuclu.oran)} — {enGuclu.puan}/{enGuclu.max_puan} puan</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-amber-700 flex items-center gap-1.5 mb-1">
              <TrendingDown size={12} /> Gelişmesi gereken konu
            </p>
            <p className="text-sm font-semibold text-amber-900">{enZayif.etiket}</p>
            <p className="text-xs text-amber-600">%{formatOranMetni(enZayif.oran)} — {enZayif.puan}/{enZayif.max_puan} puan</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {olculebilir.map(k => {
          // Çubuk genişliği sayısal yüzdeden, etiket okunabilir metinden.
          const yuzde = formatPercent(k.oran)
          return (
            <div key={k.kategori}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{k.etiket}</span>
                <span className="text-xs text-gray-400">
                  {k.puan}/{k.max_puan} <strong className="text-gray-600 font-medium">%{formatOranMetni(k.oran)}</strong>
                </span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-gray-100">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${yuzde}%`, background: RAPOR_RENK }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
