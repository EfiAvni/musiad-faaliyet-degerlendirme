import { statusConfig } from '@/utils/constants'

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending
  return (
    <span style={{ background: cfg.bg, color: cfg.text }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium">
      <span style={{ background: cfg.dot }} className="w-1.5 h-1.5 rounded-full" />
      {cfg.label}
    </span>
  )
}
