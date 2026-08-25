import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Liste altı sayfalama çubuğu. Tek sayfa varsa hiç çizilmez - kısa listelerde
 * gereksiz bir kontrol göstermemek için.
 */
export function Pagination({ page, totalPages, toplam, pageSize, onPrev, onNext, onPage, birim = 'kayıt' }: {
  page: number
  totalPages: number
  /** Filtre uygulandıktan sonraki toplam kayıt sayısı */
  toplam: number
  /** Sayfa başına kayıt sayısı - son sayfa eksik dolu olabileceği için
   *  aralık hesabı o sayfadaki satır sayısından değil buradan yapılır. */
  pageSize: number
  onPrev: () => void
  onNext: () => void
  onPage: (p: number) => void
  birim?: string
}) {
  if (totalPages <= 1) return null

  const ilk = (page - 1) * pageSize + 1
  const son = Math.min(page * pageSize, toplam)

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-gray-50 flex-wrap">
      <p className="text-xs text-gray-400 tabular-nums">
        {toplam} {birim} içinden {ilk}–{son} arası gösteriliyor
      </p>

      <div className="flex items-center gap-1">
        <button onClick={onPrev} disabled={page === 1} aria-label="Önceki sayfa"
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
          <ChevronLeft size={16} />
        </button>

        {sayfaNumaralari(page, totalPages).map((n, i) =>
          n === null ? (
            <span key={`bosluk-${i}`} className="px-1.5 text-xs text-gray-300">…</span>
          ) : (
            <button key={n} onClick={() => onPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`min-w-8 px-2 py-1 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                n === page ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
              style={n === page ? { background: '#B99C1A' } : undefined}>
              {n}
            </button>
          ),
        )}

        <button onClick={onNext} disabled={page === totalPages} aria-label="Sonraki sayfa"
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * Görünecek sayfa numaraları; uzun listelerde araya null (…) koyar.
 * 198 şube 20'şerli sayfalarda 10 sayfa eder, ama liste büyüdüğünde
 * çubuğun taşmaması için baş/son ve aktif sayfanın çevresi gösterilir.
 */
function sayfaNumaralari(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const sayfalar = new Set([1, totalPages, page, page - 1, page + 1])
  const sirali = [...sayfalar].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b)

  const sonuc: (number | null)[] = []
  sirali.forEach((n, i) => {
    if (i > 0 && n - sirali[i - 1] > 1) sonuc.push(null)
    sonuc.push(n)
  })

  return sonuc
}
