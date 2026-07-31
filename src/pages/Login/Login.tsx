import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { authApi } from '@/services/authService'
import type { User } from '@/types/auth'
import { toDisplayUser } from '@/utils/helpers'
import { MUSIAD_LOGO_URL, mockUsers, roleColor } from '@/utils/constants'
import { FormField } from '@/components/common/FormField'

export function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(email, password)
      onLogin(toDisplayUser(res.user))
    } catch {
      setError('E-posta veya parola hatalı.')
      setLoading(false)
    }
  }

  const quickLogin = async (user: User) => {
    setLoading(true)
    try {
      const res = await authApi.login(user.email, user.password ?? '')
      onLogin(toDisplayUser(res.user))
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#F6F8FA' }}>
      {/* Sol panel */}
      <div className="hidden lg:flex flex-col w-1/2 p-12 relative overflow-hidden" style={{ background: '#0A1612' }}>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(185,156,26,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(185,156,26,0.15) 0%, transparent 50%)'
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(204,170,56,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />
        <div className="relative z-10 flex-1">
          <div className="mb-16">
            <img src={MUSIAD_LOGO_URL} alt="MÜSİAD" className="h-9 w-auto object-contain" />
          </div>
          <div className="max-w-sm">
            <h2 className="text-3xl font-semibold text-white mb-4 leading-tight" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              Faaliyetlerinizi<br />kolayca yönetin
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Birimler, şubeler ve faaliyetleri tek bir platformdan takip edin ve değerlendirin.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { label: 'Aktif Birim', value: '4' },
              { label: 'Toplam Şube', value: '20' },
              { label: 'Aktif Faaliyet', value: '24' },
            ].map((s, i) => (
              <div key={i} className="p-4 rounded-2xl border border-white/[0.07]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{s.value}</p>
                <p className="text-white/40 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-white/20 text-xs">© 2024 MÜSİAD. Tüm hakları saklıdır.</p>
      </div>

      {/* Sağ: Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>
              Sisteme Giriş
            </h1>
            <p className="text-sm text-gray-500">MÜSİAD Faaliyet Değerlendirme Sistemine hoş geldiniz</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <FormField label="E-posta adresi">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ornek@musiad.org.tr"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 transition-all"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} />
            </FormField>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Parola</label>
                <span className="text-xs text-emerald-700 cursor-pointer font-medium hover:text-emerald-800">Parolamı unuttum</span>
              </div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 transition-all"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }} />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
              style={{ background: '#B99C1A', boxShadow: '0 2px 8px rgba(185,156,26,0.3)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Giriş yapılıyor...
                </span>
              ) : 'Giriş Yap'}
            </button>
          </form>

          {/* Demo hesaplar */}
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-xs text-gray-400">Demo Hesaplar</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="space-y-2">
              {mockUsers.map(u => (
                <button key={u.id} onClick={() => quickLogin(u)} disabled={loading}
                  className="w-full flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all text-left group disabled:opacity-60"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                    style={{ background: roleColor[u.role] }}>
                    {u.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.roleLabel} · {u.email}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-600 transition-colors" />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">Parola: <span className="font-mono">*rol*123</span> (ör: admin123, birim123, sube123)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
