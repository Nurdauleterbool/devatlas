import type { ComponentProps } from 'react'

type Props = ComponentProps<'button'> & { variant?: 'primary' | 'ghost' }

export default function Button({ type = 'button', variant = 'primary', className = '', ...props }: Props) {
  return <button type={type} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variant === 'primary' ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'} ${className}`} {...props} />
}
