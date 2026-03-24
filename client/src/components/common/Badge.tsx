import type { ReactNode } from 'react'

type BadgeVariant = 'default' | 'urgent' | 'high' | 'medium' | 'low' | 'success' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-hover text-secondary',
  urgent: 'bg-[#f72585]/20 text-[#f72585]',
  high: 'bg-[#ef476f]/20 text-[#ef476f]',
  medium: 'bg-[#ffd166]/20 text-[#ffd166]',
  low: 'bg-[#06d6a0]/20 text-[#06d6a0]',
  success: 'bg-green-500/20 text-green-500',
  info: 'bg-blue-500/20 text-blue-500',
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
