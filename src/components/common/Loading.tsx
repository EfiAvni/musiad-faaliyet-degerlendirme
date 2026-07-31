import { Card } from './Card'

export function Loading() {
  return (
    <Card className="p-10 flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
        Yükleniyor...
      </div>
    </Card>
  )
}
