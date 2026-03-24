import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-xs font-medium text-secondary">{label}</label>}
        <input
          ref={ref}
          className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-primary
          placeholder:text-secondary/50 outline-none transition-colors
          focus:border-accent focus:ring-1 focus:ring-accent
          ${error ? 'border-red-500' : 'border-border'}
          ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input
