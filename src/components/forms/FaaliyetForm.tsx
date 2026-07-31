import { FormField } from '@/components/common/FormField'
import { inputCls } from '@/utils/constants'
import type { Donem as ApiDonem } from '@/types/donem'

export function FaaliyetFormFields({ title, setTitle, detay, setDetay, puan, setPuan, hedef, setHedef,
  aciklama, setAciklama, tarihGerekli, setTarihGerekli, donemId, setDonemId, donemOptions, durum, setDurum,
}: {
  title: string; setTitle: (v: string) => void
  detay: string; setDetay: (v: string) => void
  puan: string; setPuan: (v: string) => void
  hedef: string; setHedef: (v: string) => void
  aciklama: string; setAciklama: (v: string) => void
  tarihGerekli: boolean; setTarihGerekli: (v: boolean) => void
  donemId?: number | ''; setDonemId?: (v: number | '') => void
  donemOptions?: ApiDonem[]
  durum?: 'active' | 'completed' | 'passive'; setDurum?: (v: 'active' | 'completed' | 'passive') => void
}) {
  return (
    <div className="space-y-4">
      <FormField label="Faaliyet Adı">
        <input className={inputCls} placeholder="Faaliyet adı..." value={title} onChange={e => setTitle(e.target.value)} />
      </FormField>
      <FormField label="Detay">
        <input className={inputCls} placeholder="Kısa detay..." value={detay} onChange={e => setDetay(e.target.value)} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Puan">
          <input className={inputCls} type="number" min="0" placeholder="0" value={puan} onChange={e => setPuan(e.target.value)} />
        </FormField>
        <FormField label="Hedef">
          <input className={inputCls} type="number" min="0" placeholder="0" value={hedef} onChange={e => setHedef(e.target.value)} />
        </FormField>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Hedef, şubenin bu faaliyeti kaç kez yapması gerektiğini gösteren adet değeridir.
        {(parseInt(puan) > 0 && parseInt(hedef) > 0) && (
          <> Bu faaliyetten kazanılabilecek maksimum puan: <strong className="text-gray-600">{(parseInt(puan) || 0) * (parseInt(hedef) || 0)}</strong> ({puan} × {hedef}).</>
        )}
      </p>
      <FormField label="Açıklama">
        <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Faaliyet açıklaması..."
          value={aciklama} onChange={e => setAciklama(e.target.value)} />
      </FormField>
      <FormField label="Tarih">
        <select className={inputCls} value={tarihGerekli ? 'evet' : 'hayir'} onChange={e => setTarihGerekli(e.target.value === 'evet')}>
          <option value="hayir">Yok — bu faaliyette tarihin anlamı yok</option>
          <option value="evet">Var — tarih seçimi yapılmalı</option>
        </select>
      </FormField>
      {donemOptions && setDonemId && (
        <FormField label="Dönem">
          <select className={inputCls} value={donemId} onChange={e => setDonemId!(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Dönem seçin...</option>
            {donemOptions.map(d => (
              <option key={d.id} value={d.id}>{d.name}{d.status === 'active' ? ' (Aktif)' : ' (Taslak)'}</option>
            ))}
          </select>
          {donemOptions.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">Önce Dönemler sayfasından bir dönem açmalısınız.</p>
          )}
        </FormField>
      )}
      {durum !== undefined && setDurum && (
        <FormField label="Durum">
          <select className={inputCls} value={durum} onChange={e => setDurum(e.target.value as 'active' | 'completed' | 'passive')}>
            <option value="active">Aktif</option>
            <option value="completed">Tamamlandı</option>
            <option value="passive">Pasif</option>
          </select>
        </FormField>
      )}
    </div>
  )
}
