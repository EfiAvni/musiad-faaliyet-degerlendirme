import { Card } from './Card'

export function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <Card className="p-12 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-50">
        <Icon size={24} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </Card>
  )
}
