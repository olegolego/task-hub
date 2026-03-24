interface AvatarProps {
  name: string
  color?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

export default function Avatar({ name, color, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color || '#4361ee' }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
