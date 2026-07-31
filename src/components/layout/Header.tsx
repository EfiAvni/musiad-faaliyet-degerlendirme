import { useState } from 'react'
import { Menu, ChevronRight, Search, Bell } from 'lucide-react'
import type { User } from '@/types/auth'
import { roleColor } from '@/utils/constants'

export function TopHeader({ onToggleSidebar, currentPageLabel, user }: {
  onToggleSidebar: () => void; currentPageLabel: string; user: User
}) {
  const [searchVal, setSearchVal] = useState('')
  return (
    <header className="flex items-center justify-between px-6 bg-white border-b border-gray-100" style={{ height: 64 }}>
      <div className="flex items-center gap-4">
        <button onClick={onToggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>MÜSİAD</span>
          <ChevronRight size={14} />
          <span className="text-gray-700 font-medium">{currentPageLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Ara..."
            className="w-56 pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
        </div>
        <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 relative transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white" style={{ background: '#B99C1A' }} />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{ background: roleColor[user.role] }}>
            {user.initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-gray-800">{user.name}</p>
            <p className="text-xs text-gray-400">{user.roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
