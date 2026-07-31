import { FormField } from '@/components/common/FormField'
import { inputCls } from '@/utils/constants'

export function KullaniciFormFields() {
  return (
    <div className="space-y-4">
      <FormField label="Ad Soyad"><input className={inputCls} placeholder="Ad Soyad..." /></FormField>
      <FormField label="E-posta"><input type="email" className={inputCls} placeholder="ornek@musiad.org.tr" /></FormField>
      <FormField label="Rol">
        <select className={inputCls}>
          <option>Süper Admin</option>
          <option>Birim Yöneticisi</option>
          <option>Şube Yöneticisi</option>
        </select>
      </FormField>
      <FormField label="Parola"><input type="password" className={inputCls} placeholder="••••••••" /></FormField>
    </div>
  )
}
