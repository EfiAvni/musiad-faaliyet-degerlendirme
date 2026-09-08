/**
 * Excel okuma kitaplığını (SheetJS) uygulamanın kendi sunucusundan yükler.
 *
 * Önceden betik çalışma anında cdn.sheetjs.com'dan çekiliyordu ve bütünlük
 * doğrulaması yoktu. Oturum jetonu tarayıcıda durduğu için bu tek bir zincir
 * oluşturuyordu: CDN ele geçirilse, Excel yükleyen bir yöneticinin
 * tarayıcısında rastgele kod çalışıp jetonu dışarı sızdırabilirdi.
 *
 * Dosya artık `public/vendor/` altında projeyle birlikte geliyor; çalışma
 * anında hiçbir üçüncü tarafa bağlanılmıyor. Kitaplık ~940 KB olduğu için
 * uygulama açılışında değil, yalnızca gerçekten Excel yüklenirken indirilir.
 */

/** SheetJS'in kullandığımız yüzeyi; tamamını tiplemeye gerek yok. */
type SheetJS = {
  read: (veri: ArrayBuffer) => { SheetNames: string[]; Sheets: Record<string, unknown> }
  utils: {
    sheet_to_json: (sayfa: unknown, secenekler: { header: 1; defval: string }) => string[][]
  }
}

const KAYNAK = `${import.meta.env.BASE_URL}vendor/xlsx.full.min.js`

let bekleyen: Promise<SheetJS> | null = null

export function xlsxYukle(): Promise<SheetJS> {
  const mevcut = (window as unknown as { XLSX?: SheetJS }).XLSX
  if (mevcut) return Promise.resolve(mevcut)

  // Aynı anda iki dosya seçilirse betiği iki kez indirmeyelim.
  bekleyen ??= new Promise<SheetJS>((resolve, reject) => {
    const etiket = document.createElement('script')
    etiket.src = KAYNAK
    etiket.onload = () => {
      const yuklenen = (window as unknown as { XLSX?: SheetJS }).XLSX
      yuklenen ? resolve(yuklenen) : reject(new Error('Kitaplık yüklendi ama XLSX tanımlanmadı.'))
    }
    etiket.onerror = () => {
      bekleyen = null // sonraki denemede tekrar şans verilsin
      reject(new Error('Excel kitaplığı yüklenemedi.'))
    }
    document.head.appendChild(etiket)
  })

  return bekleyen
}
