
import { Link } from 'react-router-dom'

type Props = {
  title: string
  description: string
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
        DevAtlas
      </p>

      <h1 className="mt-4 text-4xl font-bold">{title}</h1>
      <p className="mt-4 text-slate-400">{description}</p>

      <div className="mt-10 rounded-2xl border border-white/10 bg-[#161e34] p-8">
        <p>This section is under development.</p>

        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-indigo-500 px-5 py-3 font-semibold"
        >
          Back to Dashboard
        </Link>
      </div>
    </section>
  )
}
