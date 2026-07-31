import { useState, useMemo } from 'react'

/**
 * Genel amaçlı sayfalama hook'u. NOT: şu an uygulamadaki hiçbir sayfa gerçek
 * sayfalama (pagination) kullanmıyor (ör. Şubeler sayfası 198 kaydı tek seferde
 * listeliyor) - bu yüzden bu hook henüz hiçbir sayfaya bağlanmadı. Var olmayan bir
 * UI davranışını "kullanmak" için sayfalara eklemek mevcut davranışı değiştirir;
 * klasör yapısı gereği burada duruyor, ileride gerçek bir sayfalama ihtiyacı
 * doğduğunda hazır bir başlangıç noktası olarak kullanılabilir.
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize],
  )

  return {
    page: currentPage,
    totalPages,
    pageItems,
    nextPage: () => setPage(p => Math.min(p + 1, totalPages)),
    prevPage: () => setPage(p => Math.max(p - 1, 1)),
    setPage,
  }
}
