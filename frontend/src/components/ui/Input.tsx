import { useId } from 'react'
import type { ComponentProps } from 'react'

type InputProps = ComponentProps<'input'> & {
  label: string
  hint?: string
  error?: string
}

export default function Input({
  label,
  hint,
  error,
  id,
  className = '',
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionIds = [describedBy, hint && `${inputId}-hint`, error && `${inputId}-error`]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-slate-200">
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        aria-describedby={descriptionIds || undefined}
        aria-invalid={error ? true : invalid}
        className={`min-h-11 w-full rounded-xl border bg-canvas px-4 py-3 text-slate-100 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? 'border-red-400' : 'border-slate-500'
        } ${className}`}
      />
      {hint && <p id={`${inputId}-hint`} className="mt-2 text-sm text-slate-400">{hint}</p>}
      {error && <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  )
}
