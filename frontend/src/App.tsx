
import { useState } from 'react'
import {
  Compass,
  LayoutDashboard,
  Network,
  BookOpen,
  BarChart3,
  ArrowRight,
} from 'lucide-react'

const careers = [
  {
    name: 'Frontend Developer',
    description: 'Build modern websites and interactive interfaces.',
    skills: ['HTML', 'CSS', 'JavaScript', 'React'],
  },
  {
    name: 'Backend Developer',
    description: 'Create APIs, databases, and server applications.',
    skills: ['Python', 'SQL', 'FastAPI', 'Databases'],
  },
  {
    name: 'Data Analyst',
    description: 'Analyze data and discover useful insights.',
    skills: ['Python', 'Pandas', 'Statistics', 'SQL'],
  },
]

const navigation = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Compass, label: 'Career Paths' },
  { icon: Network, label: 'Skill Graph' },
  { icon: BookOpen, label: 'Learning' },
  { icon: BarChart3, label: 'Analytics' },
]

function App() {
  const [selected, setSelected] = useState('')

  return (
    <div className="min-h-screen bg-[#0b1020] text-white md:flex">
      <aside className="border-b border-white/10 bg-[#11182b] p-6 md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-10 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500 p-2">
            <Compass size={24} />
          </div>
          <h1 className="text-xl font-bold">DevAtlas</h1>
        </div>

        <nav className="space-y-2">
          {navigation.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-400"
            >
              <Icon size={19} />
              {label}
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-12 md:px-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            Your future in technology
          </p>

          <h2 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Find your direction.
            <span className="block text-indigo-400">
              Master your next skill.
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg text-slate-400">
            Explore IT careers, discover your skill gaps,
            and build a personalized learning roadmap.
          </p>

          <h3 className="mb-6 mt-14 text-2xl font-bold">
            Explore career paths
          </h3>

          <div className="grid gap-6 lg:grid-cols-3">
            {careers.map((career) => (
              <article
                key={career.name}
                className="rounded-3xl border border-white/10 bg-[#161e34] p-6 transition hover:border-indigo-400/50"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
                  <Network size={24} />
                </div>

                <h4 className="text-xl font-bold">{career.name}</h4>

                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-400">
                  {career.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {career.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setSelected(career.name)}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 font-semibold transition hover:bg-indigo-400"
                >
                  {selected === career.name ? 'Selected' : 'Explore path'}
                  <ArrowRight size={18} />
                </button>
              </article>
            ))}
          </div>

          {selected && (
            <div
              role="status"
              className="mt-8 rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-5"
            >
              <strong>{selected} selected!</strong>
              <p className="mt-2 text-sm text-slate-400">
                Demo mode: your selection is not saved yet.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
