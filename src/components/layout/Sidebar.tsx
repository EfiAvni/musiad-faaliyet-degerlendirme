import {
  LogOut, LayoutDashboard, Building2, UserCog, ClipboardList, Calendar, BarChart3, CheckSquare, Inbox, TrendingUp,
} from 'lucide-react'
import type { Role, User } from '@/types/auth'
import type { Page } from '@/types/navigation'
import { MUSIAD_LOGO_URL, roleColor } from '@/utils/constants'

type NavItem = { id: string; label: string; icon: React.ElementType }

// Rol & Yetkiler ve Genel Ayarlar menüden çıkarıldı: ikisi de içi boş yer
// tutucuydu ve kullanıcı tıklayınca boş sayfayla karşılaşıyordu. Roller kodda
// sabit olduğu için düzenlenebilir bir yetki ekranı gerçek bir ihtiyaç haline
// gelene kadar menüde yer kaplamamalı. Sayfalar App.tsx'te duruyor.
const navByRole: Record<Role, NavItem[]> = {
  // Süper Admin, birim yöneticisinin görebildiği her şeyi görebilmeli - backend
  // bu yetkileri zaten veriyordu, eksik olan yalnızca menü girişleriydi.
  superadmin: [
    { id: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
    { id: 'birimler',     label: 'Birimler',        icon: Building2 },
    { id: 'subeler',      label: 'Şubeler',         icon: Building2 },
    { id: 'faaliyetler',  label: 'Faaliyetler',     icon: ClipboardList },
    { id: 'donemler',     label: 'Dönemler',        icon: Calendar },
    { id: 'gonderimler',  label: 'Gönderimler',     icon: Inbox },
    { id: 'raporlar',     label: 'Raporlar',        icon: BarChart3 },
    { id: 'kullanicilar', label: 'Kullanıcılar',    icon: UserCog },
  ],
  birim_yoneticisi: [
    { id: 'dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
    { id: 'subeler',     label: 'Şubeler',       icon: Building2 },
    { id: 'faaliyetler', label: 'Faaliyetler',   icon: ClipboardList },
    { id: 'donemler',    label: 'Dönemler',      icon: Calendar },
    { id: 'gonderimler', label: 'Gönderimler',   icon: Inbox },
    { id: 'raporlar',    label: 'Raporlar',      icon: BarChart3 },
  ],
  sube_yoneticisi: [
    { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
    { id: 'faaliyetlerim', label: 'Faaliyetlerim',  icon: CheckSquare },
    { id: 'performansim',  label: 'Performansım',   icon: TrendingUp },
  ],
}

export function Sidebar({ current, onNavigate, collapsed, user, onLogout }: {
  current: Page; onNavigate: (p: Page) => void; collapsed: boolean; user: User; onLogout: () => void
}) {
  const items = navByRole[user.role]
  return (
    <aside className="flex flex-col h-screen overflow-y-auto sidebar-scrollbar transition-all duration-300"
      style={{ background: '#0A1612', width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240, borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="flex items-center px-4 py-5 border-b border-white/[0.06] overflow-hidden" style={{ minHeight: 64 }}>
        <img src={MUSIAD_LOGO_URL} alt="MÜSİAD" className="h-6 w-auto max-w-full object-contain flex-shrink-0" />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2">
        {items.map(item => {
          const Icon = item.icon
          const active = current === item.id
          return (
            <button key={item.id} onClick={() => onNavigate(item.id as Page)}
              className="w-full flex items-center gap-3 px-2.5 py-2 mb-0.5 rounded-xl transition-all duration-150 relative"
              style={{ background: active ? 'rgba(185,156,26,0.25)' : 'transparent', color: active ? '#ccaa38' : 'rgba(255,255,255,0.55)' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full" style={{ background: '#ccaa38' }} />}
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium flex-1 text-left animate-fade-in">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Kullanıcı */}
      {!collapsed && (
        <div className="border-t border-white/[0.06] p-3 animate-fade-in">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold text-white"
              style={{ background: roleColor[user.role] }}>
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{user.name}</p>
              <p className="text-white/35 text-xs truncate">{user.roleLabel}</p>
            </div>
            <button onClick={onLogout}>
              <LogOut size={13} className="text-white/30 hover:text-white/60 transition-colors" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
