import { FormField } from '@/components/common/FormField'
import { inputCls, roleLabels } from '@/utils/constants'
import type { Role } from '@/types/auth'

export type KullaniciFormState = {
  name: string
  email: string
  role: Role
  password?: string
  birim_id?: number | null
  sube_id?: number | null
}

interface KullaniciFormFieldsProps {
  data: KullaniciFormState
  onChange: (data: KullaniciFormState) => void
  birimler: { id: number; name: string }[]
  subeler: { id: number; name: string }[]
}

export function KullaniciFormFields({ data, onChange, birimler, subeler }: KullaniciFormFieldsProps) {
  const updateField = (field: keyof KullaniciFormState, value: any) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="space-y-4">
      <FormField label="Ad Soyad">
        <input
          className={inputCls}
          placeholder="Ad Soyad..."
          value={data.name}
          onChange={(e) => updateField('name', e.target.value)}
          required
        />
      </FormField>

      <FormField label="E-posta">
        <input
          type="email"
          className={inputCls}
          placeholder="ornek@musiad.org.tr"
          value={data.email}
          onChange={(e) => updateField('email', e.target.value)}
          required
        />
      </FormField>

      <FormField label="Rol">
        <select
          className={inputCls}
          value={data.role}
          onChange={(e) => {
            const role = e.target.value as Role
            onChange({
              ...data,
              role,
              birim_id: role !== 'birim_yoneticisi' && role !== 'sube_yoneticisi' ? null : data.birim_id,
              sube_id: role !== 'sube_yoneticisi' ? null : data.sube_id
            })
          }}
          required
        >
          <option value="superadmin">{roleLabels['superadmin']}</option>
          <option value="birim_yoneticisi">{roleLabels['birim_yoneticisi']}</option>
          <option value="sube_yoneticisi">{roleLabels['sube_yoneticisi']}</option>
        </select>
      </FormField>

      {(data.role === 'birim_yoneticisi' || data.role === 'sube_yoneticisi') && (
        <FormField label="Bağlı Olduğu Birim">
          <select
            className={inputCls}
            value={data.birim_id || ''}
            onChange={(e) => updateField('birim_id', e.target.value ? Number(e.target.value) : null)}
            required={data.role === 'birim_yoneticisi'}
          >
            <option value="">Birim Seçin...</option>
            {birimler.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </FormField>
      )}

      {data.role === 'sube_yoneticisi' && (
        <FormField label="Bağlı Olduğu Şube">
          <select
            className={inputCls}
            value={data.sube_id || ''}
            onChange={(e) => updateField('sube_id', e.target.value ? Number(e.target.value) : null)}
            required
          >
            <option value="">Şube Seçin...</option>
            {subeler.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FormField>
      )}

      <FormField label="Parola (Boş bırakılırsa güncellenmez)">
        <input
          type="password"
          className={inputCls}
          placeholder="••••••••"
          value={data.password || ''}
          onChange={(e) => updateField('password', e.target.value)}
        />
      </FormField>
    </div>
  )
}
