import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'soft'
type Size = 'xs' | 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[#5B5FEF] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(79,70,229,0.4)] hover:bg-[#5558E8] active:bg-[#4F46E5] dark:hover:bg-[#7376F3]',
  secondary:
    'bg-surface text-fg border border-line shadow-xs hover:bg-surface-2 hover:border-line-strong active:bg-surface-3',
  outline: 'border border-line text-fg-2 hover:text-fg hover:bg-surface-2',
  ghost: 'text-fg-2 hover:text-fg hover:bg-surface-3',
  soft: 'bg-primary-soft text-primary-ink hover:bg-primary-soft-2',
  danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
}

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-[13.5px] gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', leftIcon, rightIcon, loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" />
      ) : (
        leftIcon
      )}
      {children}
      {rightIcon}
    </button>
  )
})

export function IconButton({
  className,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg',
        '[&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}
