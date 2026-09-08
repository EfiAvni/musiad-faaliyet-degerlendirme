import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check } from 'lucide-react'
import { bildirimlerApi } from '@/services/bildirimService'
import type { Bildirim } from '@/types/bildirim'
import { BILDIRIM_RENK } from '@/types/bildirim'
import type { Page } from '@/types/navigation'
import { formatTarihUzun } from '@/utils/formatters'

/** Sunucuyu boğmadan makul tazelik: dakikada bir. */
const YENILEME_ARALIGI_MS = 60_000

export function BildirimMenusu({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [acik, setAcik] = useState(false)
  const [okunmamis, setOkunmamis] = useState(0)
  const [liste, setListe] = useState<Bildirim[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const kapsayici = useRef<HTMLDivElement>(null)

  const yukle = useCallback(async () => {
    try {
      const veri = await bildirimlerApi.list()
      setOkunmamis(veri.okunmamis)
      setListe(veri.liste)
    } catch {
      // Bildirim ikincil bir özellik: yüklenemezse sayfayı hata mesajıyla
      // meşgul etmek yerine sessizce boş kalır.
    }
  }, [])

  useEffect(() => {
    yukle()
    const t = setInterval(yukle, YENILEME_ARALIGI_MS)
    return () => clearInterval(t)
  }, [yukle])

  // Dışarı tıklayınca kapan.
  useEffect(() => {
    if (!acik) return
    const kapat = (e: MouseEvent) => {
      if (kapsayici.current && !kapsayici.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener('mousedown', kapat)
    return () => document.removeEventListener('mousedown', kapat)
  }, [acik])

  const ac = async () => {
    const yeniDurum = !acik
    setAcik(yeniDurum)
    if (yeniDurum) {
      setYukleniyor(true)
      await yukle()
      setYukleniyor(false)
    }
  }

  const bildirimeTikla = async (b: Bildirim) => {
    setAcik(false)
    if (!b.okundu) {
      setListe(prev => prev.map(x => (x.id === b.id ? { ...x, okundu: true } : x)))
      setOkunmamis(prev => Math.max(0, prev - 1))
      try {
        const { okunmamis: kalan } = await bildirimlerApi.okundu(b.id)
        setOkunmamis(kalan)
      } catch {
        yukle()
      }
    }
    if (b.sayfa) onNavigate(b.sayfa)
  }

  const tumunuOkundu = async () => {
    setListe(prev => prev.map(b => ({ ...b, okundu: true })))
    setOkunmamis(0)
    try {
      await bildirimlerApi.tumunuOkundu()
    } catch {
      yukle()
    }
  }

  return (
    <div className="relative" ref={kapsayici}>
      <button
        onClick={ac}
        aria-label={okunmamis > 0 ? `Bildirimler, ${okunmamis} okunmamış` : 'Bildirimler'}
        className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 relative transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-100"
      >
        <Bell size={18} />
        {/* Nokta yalnızca gerçekten okunmamış varken yanar. */}
        {okunmamis > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border-2 border-white flex items-center justify-center text-white"
            style={{ background: '#B99C1A', fontSize: 9, fontWeight: 700, lineHeight: 1 }}
          >
            {okunmamis > 9 ? '9+' : okunmamis}
          </span>
        )}
      </button>

      {acik && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl overflow-hidden z-50"
          style={{ boxShadow: '0 12px 32px rgba(16,33,27,0.14)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-800">Bildirimler</span>
            {okunmamis > 0 && (
              <button
                onClick={tumunuOkundu}
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
              >
                <Check size={12} /> Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {yukleniyor && liste.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Yükleniyor...</p>
            )}

            {!yukleniyor && liste.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Henüz bildiriminiz yok.</p>
            )}

            {liste.map(b => (
              <button
                key={b.id}
                onClick={() => bildirimeTikla(b)}
                className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors flex gap-3"
                style={{ background: b.okundu ? undefined : 'rgba(185,156,26,0.05)' }}
              >
                <span
                  className="w-1 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: b.tur ? BILDIRIM_RENK[b.tur] : '#9ca3af', minHeight: 32 }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-800 truncate">{b.baslik}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{b.mesaj}</span>
                  <span className="block text-xs text-gray-400 mt-1">{formatTarihUzun(b.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
