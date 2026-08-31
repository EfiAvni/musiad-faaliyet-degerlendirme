export function formatTarihKisa(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTarihUzun(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatPercent(ratio: number): number {
  return Math.round(ratio * 100)
}

/**
 * Oranı okunabilir yüzde metnine çevirir.
 *
 * formatPercent tam sayıya yuvarlıyor; bu, birim geneli kırılımlarda sorun
 * oluyordu: 198 şubenin toplamında paydalar binlere çıktığı için en güçlü ve
 * en zayıf kategori de "%0" görünüyor ve karşılaştırma kayboluyordu. Küçük
 * oranlarda bir ondalık göstererek ayrımı koruyoruz.
 */
export function formatOranMetni(ratio: number): string {
  const yuzde = ratio * 100
  if (yuzde === 0) return '0'
  if (yuzde >= 10) return String(Math.round(yuzde))
  return yuzde.toFixed(1)
}
