import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from './Card'

export function KpiCard({ label, value, change, changeType, icon: Icon, color = '#B99C1A' }: {
  label: string; value: string; change: string; changeType: 'up' | 'down' | 'neutral'
  icon: React.ElementType; color?: string
}) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
          ${changeType === 'up' ? 'bg-emerald-50 text-emerald-700' : changeType === 'down' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
          {changeType === 'up' ? <TrendingUp size={10} /> : changeType === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
          {change}
        </span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </Card>
  )
}
