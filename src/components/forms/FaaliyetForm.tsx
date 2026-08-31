import { Trash2 } from 'lucide-react'
import { FormField } from '@/components/common/FormField'
import { inputCls } from '@/utils/constants'
import type { Donem as ApiDonem } from '@/types/donem'
import type { Kademe, KriterKategori, KriterTuru } from '@/types/faaliyet'
import { KATEGORI_ETIKET, KRITER_TURU_ACIKLAMA, KRITER_TURU_ETIKET, SECILEBILIR_KATEGORILER } from '@/types/faaliyet'

export function FaaliyetFormFields({ title, setTitle, detay, setDetay, puan, setPuan, hedef, setHedef,
  aciklama, setAciklama, tarihGerekli, setTarihGerekli, donemId, setDonemId, donemOptions, durum, setDurum,
  kriterTuru = 'sayi', setKriterTuru = () => {}, kademeler = [], setKademeler,
  kategori = '', setKategori,
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
  kriterTuru?: KriterTuru; setKriterTuru?: (v: KriterTuru) => void
  kademeler?: Kademe[]; setKademeler?: (v: Kademe[]) => void
  kategori?: KriterKategori | ''; setKategori?: (v: KriterKategori | '') => void
}) {
  // Hedef yalnızca adet ya da oran hedefi olan türlerde anlamlı.
  const hedefGorunur = kriterTuru === 'sayi' || kriterTuru === 'oran'

  const enYuksekPuan = kriterTuru === 'sayi'
    ? (parseInt(puan) || 0) * (parseInt(hedef) || 0)
    : kriterTuru === 'kademeli'
      ? Math.max(0, ...kademeler.map(k => k.puan))
      : (parseInt(puan) || 0)

  return (
    <div className="space-y-4">
      <FormField label="Faaliyet Adı">
        <input className={inputCls} placeholder="Faaliyet adı..." value={title} onChange={e => setTitle(e.target.value)} />
      </FormField>
      <FormField label="Detay">
        <input className={inputCls} placeholder="Kısa detay..." value={detay} onChange={e => setDetay(e.target.value)} />
      </FormField>
      <FormField label="Nasıl Puanlanacak">
        <select className={inputCls} value={kriterTuru} onChange={e => setKriterTuru(e.target.value as KriterTuru)}>
          {(Object.keys(KRITER_TURU_ETIKET) as KriterTuru[]).map(t => (
            <option key={t} value={t}>{KRITER_TURU_ETIKET[t]}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1.5">{KRITER_TURU_ACIKLAMA[kriterTuru]}</p>
      </FormField>

      {setKategori && (
        <FormField label="Kriter Başlığı">
          <select className={inputCls} value={kategori}
            onChange={e => setKategori(e.target.value as KriterKategori | '')}>
            <option value="">Seçilmedi</option>
            {SECILEBILIR_KATEGORILER.map(k => (
              <option key={k} value={k}>{KATEGORI_ETIKET[k]}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Raporda şubenin hangi konuda güçlü, hangi konuda eksik olduğunu bu başlıklar belirler.
            Seçmezseniz faaliyet "Sınıflandırılmamış" altında toplanır.
          </p>
        </FormField>
      )}

      <div className={hedefGorunur ? 'grid grid-cols-2 gap-3' : ''}>
        <FormField label={kriterTuru === 'manuel' ? 'En Yüksek Puan' : 'Puan'}>
          <input className={inputCls} type="number" min="0" placeholder="0" value={puan} onChange={e => setPuan(e.target.value)} />
        </FormField>
        {hedefGorunur && (
          <FormField label={kriterTuru === 'oran' ? 'Hedef (%)' : 'Hedef'}>
            <input className={inputCls} type="number" min="0" placeholder="0" value={hedef} onChange={e => setHedef(e.target.value)} />
          </FormField>
        )}
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        {kriterTuru === 'sayi' && (
          <>
            Hedef, şubenin bu faaliyeti kaç kez yapması gerektiğini gösterir.
            {enYuksekPuan > 0 && <> En yüksek puan: <strong className="text-gray-600">{enYuksekPuan}</strong> ({puan} × {hedef}).</>}
          </>
        )}
        {kriterTuru === 'oran' && (
          <>
            Hedef, üyelerin yüzde kaçına ulaşılması gerektiğini gösterir. Örneğin 20 yazarsanız
            100 üyeli şubenin 20 kayıt girmesi tam puan demektir.
            {enYuksekPuan > 0 && <> En yüksek puan: <strong className="text-gray-600">{enYuksekPuan}</strong>.</>}
          </>
        )}
        {kriterTuru === 'evet_hayir' && enYuksekPuan > 0 && (
          <>Şube bu faaliyeti yaptıysa <strong className="text-gray-600">{enYuksekPuan}</strong> puan alır.</>
        )}
        {kriterTuru === 'manuel' && enYuksekPuan > 0 && (
          <>Merkez bu faaliyete en fazla <strong className="text-gray-600">{enYuksekPuan}</strong> puan verebilir.</>
        )}
        {kriterTuru === 'kademeli' && (
          <>Puan alanı bu türde kullanılmaz; puanları aşağıdaki kademelerde belirlersiniz.</>
        )}
      </p>

      {kriterTuru === 'kademeli' && setKademeler && (
        <FormField label="Kademeler">
          <div className="space-y-2">
            {kademeler.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inputCls} type="number" min="0" placeholder="Eşik (adet)"
                  value={k.esik === 0 && kademeler[i].puan === 0 ? '' : k.esik}
                  onChange={e => setKademeler(kademeler.map((x, j) => j === i ? { ...x, esik: parseInt(e.target.value) || 0 } : x))} />
                <input className={inputCls} type="number" min="0" placeholder="Puan"
                  value={k.puan || ''}
                  onChange={e => setKademeler(kademeler.map((x, j) => j === i ? { ...x, puan: parseInt(e.target.value) || 0 } : x))} />
                <button type="button" onClick={() => setKademeler(kademeler.filter((_, j) => j !== i))}
                  className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 flex-shrink-0" title="Kademeyi kaldır">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setKademeler([...kademeler, { esik: 0, puan: 0 }])}
              className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: '#B99C1A' }}>
              + Kademe Ekle
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Örnek: 3 kayıt → 10 puan, 7 kayıt → 25 puan. Şube eşiğini geçtiği en yüksek kademenin puanını alır.
          </p>
        </FormField>
      )}
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
