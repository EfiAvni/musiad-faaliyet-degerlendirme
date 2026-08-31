import { useState, useEffect } from 'react'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem } from '@/types/donem'
import { performansimApi } from '@/services/performansService'
import type { DonemPerformansi, YillikPerformansim } from '@/types/performans'
import { faaliyetKayitlariApi } from '@/services/faaliyetKayitService'
import type { FaaliyetKayit } from '@/types/faaliyetKayit'
import { inputCls } from '@/utils/constants'
import { raporTabClass } from '@/utils/helpers'
import { PageHeader } from '@/components/common/PageHeader'
import { FormField } from '@/components/common/FormField'
import { Loading } from '@/components/common/Loading'
import { PerformansimDonemTab } from './PerformansimDonemTab'
import { PerformansimYillikTab } from './PerformansimYillikTab'

/**
 * Doküman bölüm 4: şube "önceki dönemlerde girdiği bilgileri görüntüleyebilmeli"
 * ve "kendi performans sonuçlarını görüntüleyebilmelidir". Bölüm 13 geçmiş
 * dönemleri ve önceki yıl performansını ekliyor.
 *
 * Faaliyetlerim veri girişi sayfası ve yalnızca açık ayla ilgilenir; geçmiş
 * dönemler oraya sığmadığı için buraya alındı.
 */
export function PerformansimPage() {
  const [gorunum, setGorunum] = useState<'donem' | 'yillik'>('donem')

  const [donemler, setDonemler] = useState<ApiDonem[]>([])
  const [secilenDonemId, setSecilenDonemId] = useState<number | null>(null)
  const [donemVerisi, setDonemVerisi] = useState<DonemPerformansi | null>(null)
  const [kayitlar, setKayitlar] = useState<FaaliyetKayit[]>([])

  const [yillar, setYillar] = useState<number[]>([])
  const [yil, setYil] = useState<number | null>(null)
  const [yillikVeri, setYillikVeri] = useState<YillikPerformansim | null>(null)

  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  // Dönem listesi backend'de zaten şubenin kapsamıyla sınırlı ve tamamlanmış
  // dönemleri de içeriyor; burada duruma göre eleme yapmıyoruz (bölüm 13).
  useEffect(() => {
    (async () => {
      try {
        const [donemData, yilData] = await Promise.all([donemlerApi.list(), performansimApi.yillar()])
        setDonemler(donemData)
        setYillar(yilData)
        setYil(yilData[0] ?? new Date().getFullYear())
        setApiError('')
      } catch {
        setApiError('Dönem listesi yüklenemedi. Backend bağlantısını kontrol edin.')
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (gorunum !== 'donem') return
    setLoading(true)
    performansimApi.donem(secilenDonemId ?? undefined)
      .then(async veri => {
        setDonemVerisi(veri)
        setKayitlar(veri.donem ? await faaliyetKayitlariApi.list({ donem_id: veri.donem.id }) : [])
        setApiError('')
      })
      .catch(() => setApiError('Performans verisi yüklenemedi. Backend bağlantısını kontrol edin.'))
      .finally(() => setLoading(false))
  }, [secilenDonemId, gorunum])

  useEffect(() => {
    if (gorunum !== 'yillik' || yil === null) return
    setLoading(true)
    performansimApi.yillik(yil)
      .then(veri => { setYillikVeri(veri); setApiError('') })
      .catch(() => setApiError('Yıllık performans yüklenemedi. Backend bağlantısını kontrol edin.'))
      .finally(() => setLoading(false))
  }, [yil, gorunum])

  return (
    <div className="animate-fade-in">
      <PageHeader title="Performansım"
        subtitle={gorunum === 'donem'
          ? 'Bu dönemde ve geçmiş dönemlerde aldığınız puanlar'
          : 'Dönem puanlarınızın yıl içindeki toplamı'} />

      <div className="inline-flex items-center gap-1 p-1 bg-gray-50 rounded-xl mb-6">
        <button onClick={() => setGorunum('donem')} className={raporTabClass(gorunum === 'donem')}>Dönem Bazlı</button>
        <button onClick={() => setGorunum('yillik')} className={raporTabClass(gorunum === 'yillik')}>Yıllık</button>
      </div>

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <div className="mb-6 w-72">
        {gorunum === 'donem' ? (
          <FormField label="Dönem">
            {/* İlk açılışta dönemi sunucu seçiyor; seçimi state'e yazsaydık
                effect ikinci kez tetiklenip aynı veriyi tekrar çekerdi. */}
            <select className={inputCls} value={secilenDonemId ?? donemVerisi?.donem?.id ?? ''}
              onChange={e => setSecilenDonemId(e.target.value ? Number(e.target.value) : null)}>
              {donemler.map(d => (
                <option key={d.id} value={d.id}>
                  {d.birim?.name ? `${d.birim.name} · ` : ''}{d.name}
                  {d.status === 'active' ? ' (Devam ediyor)' : d.status === 'completed' ? ' (Tamamlandı)' : ' (Taslak)'}
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <div className="w-40">
            <FormField label="Yıl">
              <select className={inputCls} value={yil ?? ''} onChange={e => setYil(Number(e.target.value))}>
                {yillar.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </FormField>
          </div>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : gorunum === 'donem' ? (
        donemVerisi && <PerformansimDonemTab veri={donemVerisi} kayitlar={kayitlar} />
      ) : (
        yillikVeri && <PerformansimYillikTab veri={yillikVeri} />
      )}
    </div>
  )
}
