import { useState, useRef, useEffect } from 'react'
import { Download, Loader2, BarChart3 } from 'lucide-react'
import { donemlerApi } from '@/services/donemService'
import type { Donem as ApiDonem, PeriyotTipi } from '@/types/donem'
import { raporlarApi } from '@/services/raporService'
import type { DonemRaporu, RaporTab } from '@/types/rapor'
import {
  inputCls, PERIYOT_TIPI_LABEL, PERIYOT_TIPI_SIRALAMA, PERIYOT_TIPI_VARSAYILAN_TAB,
} from '@/utils/constants'
import { raporTabClass } from '@/utils/helpers'
import { PageHeader } from '@/components/common/PageHeader'
import { Btn } from '@/components/common/Btn'
import { FormField } from '@/components/common/FormField'
import { Loading } from '@/components/common/Loading'
import { EmptyState } from '@/components/common/EmptyState'
import { RaporGenelTab } from './RaporGenelTab'
import { RaporSubeTab } from './RaporSubeTab'
import { RaporFaaliyetTab } from './RaporFaaliyetTab'
import { RaporMatrisTab } from './RaporMatrisTab'

export function RaporlarPage({ initialDonemId }: { initialDonemId: number | null }) {
  const [donemler, setDonemler] = useState<ApiDonem[]>([])
  const [selectedDonemId, setSelectedDonemId] = useState<number | null>(initialDonemId)
  const [rapor, setRapor] = useState<DonemRaporu | null>(null)
  const [loadingDonemler, setLoadingDonemler] = useState(true)
  const [loadingRapor, setLoadingRapor] = useState(false)
  const [apiError, setApiError] = useState('')
  const [tab, setTab] = useState<RaporTab>('genel')
  const [indiriliyor, setIndiriliyor] = useState(false)
  const [periyotFiltre, setPeriyotFiltre] = useState<PeriyotTipi | 'all'>('all')
  const varsayilanTabUygulandi = useRef<number | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const data = await donemlerApi.list()
        const raporlanabilir = data.filter(d => d.status !== 'pending')
        setDonemler(raporlanabilir)
        setSelectedDonemId(prev => {
          if (prev !== null) return prev
          const ilk = raporlanabilir.find(d => d.status === 'active') ?? raporlanabilir[0]
          return ilk?.id ?? null
        })
      } catch {
        setApiError('Dönemler yüklenemedi. Backend bağlantısını kontrol edin.')
      } finally {
        setLoadingDonemler(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (selectedDonemId === null) { setRapor(null); return }
    setLoadingRapor(true)
    raporlarApi.donemRaporu(selectedDonemId)
      .then(data => { setRapor(data); setApiError('') })
      .catch(() => setApiError('Rapor yüklenemedi. Backend bağlantısını kontrol edin.'))
      .finally(() => setLoadingRapor(false))
  }, [selectedDonemId])

  useEffect(() => {
    if (rapor && varsayilanTabUygulandi.current !== rapor.donem.id) {
      setTab(PERIYOT_TIPI_VARSAYILAN_TAB[rapor.donem.periyot_tipi])
      varsayilanTabUygulandi.current = rapor.donem.id
    }
  }, [rapor])

  const filtrelenmisDonemler = periyotFiltre === 'all' ? donemler : donemler.filter(d => d.periyot_tipi === periyotFiltre)

  useEffect(() => {
    if (selectedDonemId !== null && !filtrelenmisDonemler.some(d => d.id === selectedDonemId)) {
      setSelectedDonemId(filtrelenmisDonemler[0]?.id ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periyotFiltre])

  const handleIndir = async () => {
    if (!selectedDonemId || !rapor) return
    setIndiriliyor(true)
    try {
      await raporlarApi.indirPdf(selectedDonemId, `MUSIAD-${rapor.donem.name.replace(/\s+/g, '-')}-raporu.pdf`)
    } catch {
      setApiError('PDF oluşturulamadı. Backend bağlantısını kontrol edin.')
    } finally {
      setIndiriliyor(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Raporlar" subtitle="Dönem bazlı performans raporları — şube, faaliyet ve zaman kırılımında"
        actions={
          <Btn variant="primary" onClick={handleIndir} disabled={!rapor || indiriliyor}>
            {indiriliyor ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {indiriliyor ? 'Hazırlanıyor...' : 'PDF İndir'}
          </Btn>
        } />

      {apiError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{apiError}</div>
      )}

      <div className="mb-6 flex items-end gap-4 flex-wrap">
        <div className="w-56">
          <FormField label="Rapor Dönemi Türü">
            <select className={inputCls} value={periyotFiltre}
              onChange={e => setPeriyotFiltre(e.target.value as PeriyotTipi | 'all')}>
              <option value="all">Tümü</option>
              {PERIYOT_TIPI_SIRALAMA.map(tip => (
                <option key={tip} value={tip}>{PERIYOT_TIPI_LABEL[tip]}</option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="w-72">
          <FormField label="Dönem">
            <select className={inputCls} value={selectedDonemId ?? ''}
              onChange={e => setSelectedDonemId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Dönem seçin...</option>
              {filtrelenmisDonemler.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.status === 'active' ? ' (Aktif)' : ' (Tamamlandı)'}</option>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {loadingDonemler ? (
        <Loading />
      ) : donemler.length === 0 ? (
        <EmptyState icon={BarChart3} title="Rapor için uygun dönem yok" subtitle="Bir dönemi aktif ettiğinizde veya tamamladığınızda burada raporlanabilir." />
      ) : filtrelenmisDonemler.length === 0 ? (
        <EmptyState icon={BarChart3} title="Bu dönem türünde rapor bulunmuyor" subtitle='Farklı bir dönem türü seçin veya "Tümü" seçeneğine dönün.' />
      ) : !selectedDonemId || loadingRapor || !rapor ? (
        <Loading />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-gray-50 rounded-xl">
              <button onClick={() => setTab('genel')} className={raporTabClass(tab === 'genel')}>Genel Özet</button>
              <button onClick={() => setTab('sube')} className={raporTabClass(tab === 'sube')}>Şube Bazlı</button>
              <button onClick={() => setTab('faaliyet')} className={raporTabClass(tab === 'faaliyet')}>Faaliyet Bazlı</button>
              <button onClick={() => setTab('matris')} className={raporTabClass(tab === 'matris')}>Matris</button>
            </div>
            <span className="text-xs text-gray-400 px-1">
              {PERIYOT_TIPI_LABEL[rapor.donem.periyot_tipi]} dönem
            </span>
          </div>

          {tab === 'genel' && <RaporGenelTab rapor={rapor} />}
          {tab === 'sube' && <RaporSubeTab rapor={rapor} />}
          {tab === 'faaliyet' && <RaporFaaliyetTab rapor={rapor} />}
          {tab === 'matris' && <RaporMatrisTab rapor={rapor} />}
        </>
      )}
    </div>
  )
}
