import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import type { Page } from '@/types/navigation'
import { pageLabels } from '@/utils/constants'
import { PlaceholderPage } from '@/components/common/PlaceholderPage'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopHeader } from '@/components/layout/Header'
import { LoginPage } from '@/pages/Login/Login'
import { SuperAdminDashboard } from '@/pages/Dashboard/SuperAdminDashboard'
import { BirimYoneticisiDashboard } from '@/pages/Dashboard/BirimYoneticisiDashboard'
import { SubeYoneticisiDashboard } from '@/pages/Dashboard/SubeYoneticisiDashboard'
import { BirimlerPage } from '@/pages/Birimler/Birimler'
import { KullanicilarPage } from '@/pages/Kullanicilar/Kullanicilar'
import { SubelerPage } from '@/pages/Subeler/Subeler'
import { FaaliyetlerPage } from '@/pages/Faaliyetler/Faaliyetler'
import { FaaliyetlerimPage } from '@/pages/Faaliyetler/Faaliyetlerim'
import { DonemlerPage } from '@/pages/Donemler/Donemler'
import { RaporlarPage } from '@/pages/Raporlar/Raporlar'

// ─── App Shell ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>('login')
  const { currentUser, authChecked, login: handleLogin, logout: handleLogout } = useAuth(setPage)
  const { isSuperAdmin, isBirimYoneticisi } = usePermissions(currentUser)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [faaliyetlerInitialDonemId, setFaaliyetlerInitialDonemId] = useState<number | null>(null)
  const [raporlarInitialDonemId, setRaporlarInitialDonemId] = useState<number | null>(null)

  const handleNavigate = (p: Page) => {
    setFaaliyetlerInitialDonemId(null)
    setRaporlarInitialDonemId(null)
    setPage(p)
  }

  const openFaaliyetlerForDonem = (donemId: number) => {
    setFaaliyetlerInitialDonemId(donemId)
    setPage('faaliyetler')
  }

  const openRaporForDonem = (donemId: number) => {
    setRaporlarInitialDonemId(donemId)
    setPage('raporlar')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F6F8FA' }}>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid #e5e7eb', borderTopColor: '#B99C1A' }} />
          Oturum doğrulanıyor...
        </div>
      </div>
    )
  }

  if (!currentUser) return <LoginPage onLogin={handleLogin} />

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        if (isSuperAdmin)       return <SuperAdminDashboard onNavigate={handleNavigate} />
        if (isBirimYoneticisi) return <BirimYoneticisiDashboard onNavigate={handleNavigate} user={currentUser} />
        return <SubeYoneticisiDashboard onNavigate={handleNavigate} user={currentUser} />
      case 'birimler':      return <BirimlerPage />
      case 'kullanicilar':  return <KullanicilarPage />
      case 'roller':        return <PlaceholderPage title="Rol & Yetkiler"  subtitle="Roller ve yetki yönetimi" />
      case 'ayarlar':       return <PlaceholderPage title="Genel Ayarlar"   subtitle="Sistem ayarları" />
      case 'subeler':       return <SubelerPage />
      case 'faaliyetler':   return <FaaliyetlerPage initialDonemId={faaliyetlerInitialDonemId} />
      case 'donemler':      return <DonemlerPage onShowFaaliyetler={openFaaliyetlerForDonem} onShowRapor={openRaporForDonem} user={currentUser} />
      case 'faaliyetlerim': return <FaaliyetlerimPage />
      case 'raporlar':      return <RaporlarPage initialDonemId={raporlarInitialDonemId} />
      default:              return null
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar current={page} onNavigate={handleNavigate} collapsed={sidebarCollapsed} user={currentUser} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader onToggleSidebar={() => setSidebarCollapsed(p => !p)} currentPageLabel={pageLabels[page] || ''} user={currentUser} />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
