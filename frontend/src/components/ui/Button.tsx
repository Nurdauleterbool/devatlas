import type { ComponentProps } from 'react'

export type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost'
}

export default function Button({ type = 'button', variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'primary'
          ? 'bg-indigo-600 text-white enabled:hover:bg-indigo-700'
          : 'text-slate-300 enabled:hover:bg-white/5 enabled:hover:text-white'
      } ${className}`}
      {...props}
    />
  )
}
