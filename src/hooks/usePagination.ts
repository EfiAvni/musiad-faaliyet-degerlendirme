import { useState, useMemo } from 'react'

/**
 * İstemci tarafı sayfalama. Şube ve kullanıcı listeleri birkaç yüz kayıtla
 * sınırlı olduğu için tüm veri tek istekte gelir; burada yalnızca kaç satırın
 * DOM'a çizileceği sınırlanır. Liste binlere çıkarsa sunucu taraflı sayfalamaya
 * geçilmeli.
 *
 * Filtre değişince sayfa numarasını çağıran taraf setPage(1) ile sıfırlar;
 * hook ayrıca sayfa sayısı düşerse mevcut sayfayı sınır içine çeker.
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
