import { useEffect } from 'react'

/**
 * Tarayıcılar, odaklanmış bir sayı alanının üzerinde tekerlek çevrildiğinde
 * değeri artırıp azaltır. Uzun formlarda kullanıcı sayfayı kaydırırken puan,
 * hedef veya kademe değeri sessizce değişebiliyor - ve bu ancak dönem
 * sonunda yanlış puanlama olarak fark ediliyor.
 *
 * Alanın üzerindeki tekerlek olayını iptal edip odağı kaldırıyoruz: sayfa
 * normal şekilde kayar, değer korunur.
 */
export function useSayiAlaniKaydirmaKorumasi() {
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      const el = e.target
      if (
        el instanceof HTMLInputElement
        && el.type === 'number'
        && document.activeElement === el
      ) {
        e.preventDefault()
        el.blur()
      }
    }

    // preventDefault çağırabilmek için passive olmamalı.
    document.addEventListener('wheel', handler, { passive: false })
    return () => document.removeEventListener('wheel', handler)
  }, [])
}
