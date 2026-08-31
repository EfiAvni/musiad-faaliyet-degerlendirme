import type { Role } from '@/types/auth'
import type { PeriyotTipi } from '@/types/donem'
import type { RaporTab } from '@/types/rapor'

// Logo projeye dahildir; daha önce Wikipedia'dan doğrudan çekiliyordu ve o
// bağlantı koptuğunda her sayfada kırık görünüyordu. Vite dosyayı derlemeye
// katıp adına içerik özeti ekler, böylece önbellek de doğru tazelenir.
import musiadLogo from '@/assets/musiad-logo.png'

export const MUSIAD_LOGO_URL = musiadLogo

export const roleLabels: Record<Role, string> = {
  superadmin: 'Süper Admin', birim_yoneticisi: 'Birim Yöneticisi', sube_yoneticisi: 'Şube Yöneticisi',
}

// ─── Renk Yardımcıları ─────────────────────────────────────────────────────────

export const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:    { label: 'Aktif',       bg: '#fbf7e6', text: '#6e5c0f', dot: '#a38817' },
  passive:   { label: 'Pasif',       bg: '#f9fafb', text: '#6b7280', dot: '#9ca3af' },
  completed: { label: 'Tamamlandı',  bg: '#eff6ff', text: '#1e40af', dot: '#3b82f6' },
  pending:   { label: 'Beklemede',   bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
}

export const roleColor: Record<Role, string> = {
  superadmin:       '#7c3aed',
  birim_yoneticisi: '#2563eb',
  sube_yoneticisi:  '#B99C1A',
}

export const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all'

// ─── Raporlar ──────────────────────────────────────────────────────────────────

export const RAPOR_RENK = '#B99C1A'

export const PERIYOT_TIPI_LABEL: Record<PeriyotTipi, string> = {
  monthly: 'Aylık',
  quarterly: '3 Aylık',
  semi_annual: '6 Aylık',
  annual: 'Yıllık',
  custom: 'Özel',
}

export const PERIYOT_TIPI_SIRALAMA: PeriyotTipi[] = ['monthly', 'quarterly', 'semi_annual', 'annual', 'custom']

export const PERIYOT_TIPI_VARSAYILAN_TAB: Record<PeriyotTipi, RaporTab> = {
  monthly: 'genel',
  quarterly: 'sube',
  semi_annual: 'faaliyet',
  annual: 'matris',
  custom: 'genel',
}

// ─── App Shell ─────────────────────────────────────────────────────────────────

export const pageLabels: Record<string, string> = {
  dashboard:     'Dashboard',
  birimler:      'Birimler',
  kullanicilar:  'Kullanıcılar',
  roller:        'Rol & Yetkiler',
  ayarlar:       'Genel Ayarlar',
  subeler:       'Şubeler',
  faaliyetler:   'Faaliyetler',
  donemler:      'Dönemler',
  faaliyetlerim: 'Faaliyetlerim',
  performansim:  'Performansım',
  gonderimler:   'Gönderimler',
  raporlar:      'Raporlar',
}
