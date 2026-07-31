import { FormField } from '@/components/common/FormField'

export function SubeScopeToggle({ tumSubeler, setTumSubeler }: { tumSubeler: boolean; setTumSubeler: (v: boolean) => void }) {
  return (
    <FormField label="Şube Kapsamı">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setTumSubeler(true)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${tumSubeler ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
          Tüm Şubeler
        </button>
        <button type="button" onClick={() => setTumSubeler(false)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${!tumSubeler ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>
          Belirli Şubeler
        </button>
      </div>
    </FormField>
  )
}
