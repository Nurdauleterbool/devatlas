import type { ComponentProps } from 'react'

type CardProps = ComponentProps<'article'> & { highlighted?: boolean }

export default function Card({ highlighted = false, className = '', ...props }: CardProps) {
  return (
    <article
      className={`rounded-3xl border p-6 ${
        highlighted
          ? 'border-indigo-400 bg-indigo-500/10'
          : 'border-white/10 bg-surface'
      } ${className}`}
      {...props}
    />
  )
}
