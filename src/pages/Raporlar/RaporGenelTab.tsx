import { Trophy } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { DonemRaporu } from '@/types/rapor'
import { RAPOR_RENK } from '@/utils/constants'
import { formatPercent } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { RaporChartTooltip } from './RaporChartTooltip'

export function RaporGenelTab({ rapor }: { rapor: DonemRaporu }) {
  const { genel, aylik_trend } = rapor
  const trendData = aylik_trend.map(a => ({ name: a.ay.split(' ')[0], kayit: a.kayit_sayisi }))
  const tamamlanmaYuzde = formatPercent(genel.ortalama_tamamlanma)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Kapsamdaki Şube', value: genel.toplam_sube, color: '#2563eb' },
          { label: 'Toplam Faaliyet', value: genel.toplam_faaliyet, color: RAPOR_RENK },
          { label: 'Toplam Kayıt', value: genel.toplam_kayit, color: '#059669' },
          { label: 'Toplam Hedef', value: genel.toplam_hedef, color: '#f59e0b' },
        ].map((s, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ background: s.color }} />
            <div>
              <p className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Ortalama Tamamlanma Oranı</h3>
          <span className="text-sm font-semibold" style={{ color: RAPOR_RENK }}>%{tamamlanmaYuzde}</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: `${RAPOR_RENK}20` }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tamamlanmaYuzde}%`, background: RAPOR_RENK }} />
        </div>
        {genel.en_iyi_sube_adi && (
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
            <Trophy size={12} style={{ color: RAPOR_RENK }} />
            En yüksek performans: <strong className="text-gray-600 font-medium">{genel.en_iyi_sube_adi}</strong>
            {genel.en_iyi_sube_orani !== null && ` (%${formatPercent(genel.en_iyi_sube_orani)})`}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Aylık Kayıt Dağılımı</h3>
        {trendData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Bu döneme ait değerlendirme ayı bulunmuyor.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="raporTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RAPOR_RENK} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={RAPOR_RENK} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e1e0d9" strokeDasharray="0" />
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<RaporChartTooltip suffix=" kayıt" />} />
              <Area type="monotone" dataKey="kayit" stroke={RAPOR_RENK} strokeWidth={2} fill="url(#raporTrendFill)" dot={{ r: 3, fill: RAPOR_RENK, strokeWidth: 0 }} activeDot={{ r: 5, fill: RAPOR_RENK, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
