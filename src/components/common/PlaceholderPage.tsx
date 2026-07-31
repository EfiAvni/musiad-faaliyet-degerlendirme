import { Settings } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { EmptyState } from './EmptyState'

export function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState icon={Settings} title="Bu sayfa hazırlanıyor" subtitle="Yakında burada içerik göreceksiniz." />
    </div>
  )
}
