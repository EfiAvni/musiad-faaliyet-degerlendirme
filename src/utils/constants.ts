import type { Role, User } from '@/types/auth'
import type { PeriyotTipi } from '@/types/donem'
import type { RaporTab } from '@/types/rapor'

export const MUSIAD_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/tr/thumb/4/4f/Musiad_Logo.png/960px-Musiad_Logo.png?_=20230216124853'

// ─── Mock Kullanıcılar ─────────────────────────────────────────────────────────

export const mockUsers: User[] = [
  {
    id: 1, name: 'Muhammet Avni Küçük', email: 'avni.kucuk@musiad.org.tr',
    password: 'admin123', role: 'superadmin', roleLabel: 'Süper Admin', initials: 'AK',
  },
  {
    id: 2, name: 'Hüseyin Özer', email: 'huseyin.ozer@musiad.org.tr',
    password: 'birim123', role: 'birim_yoneticisi', roleLabel: 'Birim Yöneticisi',
    birim: 'Teşkilatlanma', initials: 'HÖ',
  },
  {
    id: 3, name: 'Ankara Şb. Yöneticisi', email: 'ankara@musiad.org.tr',
    password: 'sube123', role: 'sube_yoneticisi', roleLabel: 'Şube Yöneticisi',
    birim: 'Teşkilatlanma', sube: 'Ankara Şubesi', initials: 'AŞ',
  },
]

export const roleLabels: Record<Role, string> = {
  superadmin: 'Süper Admin', birim_yoneticisi: 'Birim Yöneticisi', sube_yoneticisi: 'Şube Yöneticisi',
}

// ─── Mock Veri ─────────────────────────────────────────────────────────────────

export const birimler: { id: number; name: string; sube_count: number; faaliyet_count: number; yonetici: string; status: string; created: string }[] = []

export const subeler: { id: number; name: string; birim: string; yonetici: string; status: string; uye_sayisi: number; faaliyet_tamamlanan: number; faaliyet_toplam: number }[] = []

export const donemler: { id: number; name: string; start: string; end: string; status: string; faaliyet_count: number }[] = []

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
  raporlar:      'Raporlar',
}
