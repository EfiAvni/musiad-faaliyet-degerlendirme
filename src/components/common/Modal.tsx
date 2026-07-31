import { X, Trash2 } from 'lucide-react'
import { Card } from './Card'
import { Btn } from './Btn'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <Card className={`w-full p-6 transition-all duration-200 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </Card>
    </div>
  )
}

export function ConfirmModal({ title, message, confirmLabel = 'Sil', onConfirm, onCancel, loading }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900" style={{ fontFamily: 'Instrument Sans, sans-serif' }}>{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Btn variant="secondary" onClick={onCancel} disabled={loading}>Vazgeç</Btn>
          <Btn variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Siliniyor...' : confirmLabel}
          </Btn>
        </div>
      </Card>
    </div>
  )
}
