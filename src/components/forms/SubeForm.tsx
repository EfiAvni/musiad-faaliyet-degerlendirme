import { FormField } from '@/components/common/FormField'
import { inputCls } from '@/utils/constants'

export function SubeFormFields({ name, setName, uyeSayisi, setUyeSayisi, durum, setDurum, error }: {
  name: string; setName: (v: string) => void
  uyeSayisi: string; setUyeSayisi: (v: string) => void
  durum?: 'active' | 'passive'; setDurum?: (v: 'active' | 'passive') => void
  error?: string
}) {
  return (
    <div className="space-y-4">
      <FormField label="Şube Adı">
        <input className={inputCls} placeholder="Şube adını girin..." value={name} onChange={e => setName(e.target.value)} />
      </FormField>
      <FormField label="Toplam Üye Sayısı">
        <input className={inputCls} type="number" placeholder="0" min="0" value={uyeSayisi} onChange={e => setUyeSayisi(e.target.value)} />
      </FormField>
      {durum !== undefined && setDurum && (
        <FormField label="Durum">
          <select className={inputCls} value={durum} onChange={e => setDurum(e.target.value as 'active' | 'passive')}>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
        </FormField>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
