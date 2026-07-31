import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { DonemRaporu, RaporFaaliyet } from '@/types/rapor'
import { RAPOR_RENK } from '@/utils/constants'
import { formatPercent } from '@/utils/formatters'
import { Card } from '@/components/common/Card'
import { DataTable, type DataTableColumn } from '@/components/common/DataTable'
import { RaporChartTooltip } from './RaporChartTooltip'

function buildColumns(toplamSube: number): DataTableColumn<RaporFaaliyet>[] {
  return [
    {
      header: 'Faaliyet',
      headerClassName: 'px-5 py-3 font-medium',
      cellClassName: 'px-5 py-2.5 text-gray-800 font-medium',
      render: f => f.title,
    },
    {
      header: 'Puan',
      headerClassName: 'px-5 py-3 font-medium text-right',
      cellClassName: 'px-5 py-2.5 text-right text-gray-600',
      render: f => f.puan,
    },
    {
      header: 'Hedef',
      headerClassName: 'px-5 py-3 font-medium text-right',
      cellClassName: 'px-5 py-2.5 text-right text-gray-600',
      render: f => f.hedef,
    },
    {
      header: 'Toplam Kayıt',
      headerClassName: 'px-5 py-3 font-medium text-right',
      cellClassName: 'px-5 py-2.5 text-right text-gray-600',
      render: f => f.toplam_kayit,
    },
    {
      header: 'Katılan Şube',
      headerClassName: 'px-5 py-3 font-medium text-right',
      cellClassName: 'px-5 py-2.5 text-right text-gray-600',
      render: f => `${f.katilan_sube_sayisi} / ${toplamSube}`,
    },
    {
      header: 'Doluluk',
      headerClassName: 'px-5 py-3 font-medium',
      cellClassName: 'px-5 py-2.5',
      render: f => (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: `${RAPOR_RENK}20` }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, formatPercent(f.doluluk_orani))}%`, background: RAPOR_RENK }} />
          </div>
          <span className="text-xs text-gray-500">%{formatPercent(f.doluluk_orani)}</span>
        </div>
      ),
    },
  ]
}

export function RaporFaaliyetTab({ rapor }: { rapor: DonemRaporu }) {
  const { faaliyet_bazli, genel } = rapor
  const chartData = faaliyet_bazli.slice(0, 10).map(f => ({ name: f.title, kayit: f.toplam_kayit }))
  const chartHeight = Math.max(120, chartData.length * 34)
  const columns = buildColumns(genel.toplam_sube)

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Faaliyet Bazlı Kayıt Sayısı</h3>
        <p className="text-xs text-gray-400 mb-4">{faaliyet_bazli.length > 10 ? 'İlk 10 faaliyet — tam liste aşağıdaki tabloda' : 'Toplam kayıt sayısına göre sıralı'}</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Bu döneme tanımlanmış faaliyet bulunmuyor.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="#e1e0d9" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: '#52514e' }} axisLine={false} tickLine={false} />
              <Tooltip content={<RaporChartTooltip suffix=" kayıt" />} cursor={{ fill: '#f9f9f7' }} />
              <Bar dataKey="kayit" fill={RAPOR_RENK} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>Tüm Faaliyetler</h3>
        </div>
        <DataTable
          columns={columns}
          data={faaliyet_bazli}
          keyExtractor={f => f.faaliyet_id}
          headerRowClassName="border-t border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide"
          rowClassName="border-t border-gray-50"
          emptyMessage="Faaliyet bulunmuyor."
          className="overflow-x-auto mt-3"
        />
      </Card>
    </div>
  )
}
