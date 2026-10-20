
import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import {
  Compass,
  LayoutDashboard,
  Network,
  BookOpen,
  BarChart3,
  ArrowRight,
  Menu,
  X,
} from 'lucide-react'

import { mockService } from './services/mockService'
import type { CareerPath } from './services/mockService'
import PlaceholderPage from './pages/PlaceholderPage'

const navigation = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Compass, label: 'Career Paths', path: '/careers' },
  { icon: Network, label: 'Skill Graph', path: '/graph' },
  { icon: BookOpen, label: 'Learning', path: '/learning' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
]

function Dashboard() {
  const [careers, setCareers] = useState<CareerPath[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    mockService
      .getCareerPaths()
      .then((data) => {
        if (!active) return
        setCareers(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError('Failed to load career paths.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-indigo-400">
        Your future in technology
      </p>

      <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
        Find your direction.
        <span className="block text-indigo-400">
          Master your next skill.
        </span>
      </h1>

      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
        Explore IT careers, discover your skill gaps,
        and build a personalized learning roadmap.
      </p>

      <div className="mb-6 mt-14 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">
          Explore career paths
        </h2>
        <span className="text-sm text-slate-400">
          {careers.length} paths available
        </span>
      </div>

      {loading && (
        <p role="status" className="mb-6 text-slate-400">
          Loading career paths...
        </p>
      )}

      {error && (
        <p role="alert" className="mb-6 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && careers.length === 0 && (
        <p className="text-slate-400">
          No career paths available.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {careers.map((career) => (
          <article
            key={career.id}
            className={`rounded-3xl border p-6 transition ${
              selected === career.id
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-white/10 bg-[#161e34] hover:border-indigo-400/50'
            }`}
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Network size={24} />
            </div>

            <h3 className="text-xl font-bold">
              {career.name}
            </h3>

            <p className="mt-3 min-h-16 text-sm leading-6 text-slate-400">
              {career.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {career.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  {skill.name}
                </span>
              ))}
            </div>

            <div className="mt-6 text-sm text-slate-400">
              {career.skills.length} skills in this path
            </div>

            <button
              type="button"
              onClick={() => setSelected(career.id)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-400"
            >
              {selected === career.id ? 'Selected' : 'Explore path'}
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
          <h3 className="font-semibold">
            {careers.find((career) => career.id === selected)?.name} selected!
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Demo mode: your selection is not saved yet.
          </p>

          <Link
            to="/careers"
            className="mt-4 inline-block text-indigo-400 hover:underline"
          >
            View career paths →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0b1020] text-white md:flex">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-10 bg-black/60 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`${
          menuOpen ? 'flex' : 'hidden'
        } fixed inset-y-0 left-0 z-20 w-64 flex-col border-r border-white/10 bg-[#11182b] p-6 md:sticky md:top-0 md:flex md:h-screen md:shrink-0`}
      >
        <div className="mb-10 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex items-center gap-3"
            onClick={() => setMenuOpen(false)}
          >
            <div className="rounded-xl bg-indigo-500 p-2">
              <Compass size={24} />
            </div>

            <span className="text-xl font-bold">
              DevAtlas
            </span>
          </Link>

          <button
            type="button"
            className="md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <nav
          aria-label="Main navigation"
          className="space-y-2"
        >
          {navigation.map(({ icon: Icon, label, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 transition ${
                  isActive
                    ? 'bg-indigo-500/15 font-medium text-indigo-300'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4">
          <p className="font-semibold">
            Your learning journey
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Explore career paths and discover your next skill.
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-4 border-b border-white/10 px-6 py-4 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={24} />
          </button>

          <span className="font-bold">
            DevAtlas
          </span>
        </header>

        <main>
          <Routes>
            <Route
              path="/"
              element={<Dashboard />}
            />

            <Route
              path="/careers"
              element={
                <PlaceholderPage
                  title="Career Paths"
                  description="Explore frontend, backend and data analyst career roadmaps."
                />
              }
            />

            <Route
              path="/graph"
              element={
                <PlaceholderPage
                  title="Skill Graph"
                  description="Explore skill dependencies and discover what to learn next."
                />
              }
            />

            <Route
              path="/learning"
              element={
                <PlaceholderPage
                  title="Learning"
                  description="Access learning resources, practice exercises and quizzes."
                />
              }
            />

            <Route
              path="/analytics"
              element={
                <PlaceholderPage
                  title="Analytics"
                  description="Track skill progress, quiz scores and learning history."
                />
              }
            />

            <Route
              path="*"
              element={
                <PlaceholderPage
                  title="Page not found"
                  description="This page does not exist."
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  )
}
