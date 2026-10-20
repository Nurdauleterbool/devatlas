import type { ComponentProps } from 'react'

export default function Card({ className = '', ...props }: ComponentProps<'article'>) {
  return <article className={`rounded-3xl border border-white/10 bg-[#161e34] p-6 ${className}`} {...props} />
}
