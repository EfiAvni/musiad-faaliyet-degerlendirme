export function Btn({ children, variant = 'primary', size = 'md', onClick, type = 'button', disabled }: {
  children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean
}) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-xl transition-all duration-150 cursor-pointer border-0'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary:   'text-white hover:opacity-90 active:scale-95 disabled:opacity-60',
    secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95',
    ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 active:scale-95',
    danger:    'bg-red-50 text-red-600 hover:bg-red-100 active:scale-95',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]}`}
      style={variant === 'primary' ? { background: '#B99C1A' } : {}}>
      {children}
    </button>
  )
}
