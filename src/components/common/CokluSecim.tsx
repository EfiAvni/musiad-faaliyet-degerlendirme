import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export type CokluSecimSecenegi = { deger: string; etiket: string }

/**
 * Onay kutulu açılır liste.
 *
 * Boş seçim "hepsi" demektir - kullanıcı hiçbir şey seçmeden raporu daraltmış
 * olmaz. Native <select multiple> yerine bu bileşen var çünkü çoklu seçimde
 * ctrl+tık gerektiren native davranış rapor ekranında keşfedilebilir değil.
 */
export function CokluSecim({ etiket, secenekler, secili, onChange, hepsiEtiketi = 'Hepsi' }: {
  etiket: string
  secenekler: CokluSecimSecenegi[]
  secili: string[]
  onChange: (yeni: string[]) => void
  hepsiEtiketi?: string
}) {
  const [acik, setAcik] = useState(false)
  const kapsayici = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const kapat = (e: MouseEvent) => {
      if (kapsayici.current && !kapsayici.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', kapat)
    return () => document.removeEventListener('mousedown', kapat)
  }, [acik])

  const degistir = (deger: string) => {
    onChange(secili.includes(deger) ? secili.filter(d => d !== deger) : [...secili, deger])
  }

  const ozet = secili.length === 0
    ? hepsiEtiketi
    : secili.length === 1
      ? secenekler.find(s => s.deger === secili[0])?.etiket ?? '1 seçili'
      : `${secili.length} seçili`

  return (
    <div className="relative" ref={kapsayici}>
      <label className="block text-xs text-gray-500 mb-1.5">{etiket}</label>
      <button
        type="button"
        onClick={() => setAcik(a => !a)}
        aria-expanded={acik}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
      >
        <span className={secili.length ? 'text-gray-800 truncate' : 'text-gray-400 truncate'}>{ozet}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      {acik && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl overflow-hidden z-40 max-h-64 overflow-y-auto"
          style={{ boxShadow: '0 12px 32px rgba(16,33,27,0.14)', minWidth: 200 }}
        >
          {secili.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 border-b border-gray-50 transition-colors"
            >
              Seçimi temizle
            </button>
          )}
          {secenekler.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">Seçenek yok.</p>
          )}
          {secenekler.map(s => {
            const isaretli = secili.includes(s.deger)
            return (
              <button
                key={s.deger}
                type="button"
                onClick={() => degistir(s.deger)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border"
                  style={{
                    background: isaretli ? '#B99C1A' : '#fff',
                    borderColor: isaretli ? '#B99C1A' : '#d1d5db',
                  }}
                >
                  {isaretli && <Check size={11} className="text-white" />}
                </span>
                <span className="text-gray-700 truncate">{s.etiket}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
