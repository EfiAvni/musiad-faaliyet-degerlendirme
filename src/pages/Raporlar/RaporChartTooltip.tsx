export function RaporChartTooltip({ active, payload, label, suffix = '' }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <p className="font-medium text-gray-700 mb-0.5">{label}</p>
      <p className="text-gray-500">{payload[0].value}{suffix}</p>
    </div>
  )
}
