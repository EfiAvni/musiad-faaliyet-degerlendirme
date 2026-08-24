import { useState } from 'react'
import { authApi } from '@/services/authService'
import { ApiError } from '@/services/api'
import type { User } from '@/types/auth'
import { toDisplayUser } from '@/utils/helpers'
import { MUSIAD_LOGO_URL } from '@/utils/constants'
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
    } catch (err) {
      // Sunucu hız sınırı gibi durumlarda kullanıcıya ne yapması gerektiğini
      // söyleyen kendi mesajını gönderiyor; onu olduğu gibi gösteriyoruz.
      setError(err instanceof ApiError ? err.message : 'E-posta veya parola hatalı.')
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
          <div className="mt-12 space-y-3">
            {[
              'Dönem planla, faaliyet tanımla',
              'Şubelerin kayıtlarını topla',
              'Puan ve tamamlanma raporlarını al',
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#ccaa38' }} />
                <p className="text-white/50 text-sm">{s}</p>
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

          <p className="text-xs text-gray-400 text-center mt-6">
            Hesabınız yoksa birim yöneticinizle iletişime geçin.
          </p>
        </div>
      </div>
    </div>
  )
}
