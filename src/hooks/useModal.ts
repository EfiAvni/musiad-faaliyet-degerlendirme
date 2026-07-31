import { useState } from 'react'

/**
 * Sayfalarda tekrar eden "silme onayı" deseni için: bir hedef kayıt (ör. silinecek
 * şube/faaliyet) + bir yükleniyor bayrağı. Çok alanlı create/edit modalları (name,
 * puan, hedef gibi çoklu form state'i olanlar) bu hook'a taşınmadı - onlar hâlâ
 * sayfa-yerel state olarak kalıyor, davranış riskini artırmamak için.
 */
export function useModal<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)

  const close = () => setTarget(null)

  return { target, setTarget, loading, setLoading, close, isOpen: target !== null }
}
