
import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import {
  Compass,
  Network,
  ArrowRight,
  Menu,
} from 'lucide-react'

import { service } from './services'
import { useCareerRoadmaps } from './hooks/useCareerRoadmaps'
import PlaceholderPage from './pages/PlaceholderPage'
import CareerPathsPage from './pages/CareerPathsPage'
import SidebarNavigation from './components/SidebarNavigation'
import Button from './components/ui/Button'
import Card from './components/ui/Card'
import Dialog from './components/ui/Dialog'
import AuthPage from './pages/AuthPage'
import { useAuth } from './auth/authContext'

function Dashboard() {
  const { careers, loading, error } = useCareerRoadmaps(service)
  const [selected, setSelected] = useState('')

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
          Failed to load career paths.
        </p>
      )}

      {!loading && !error && careers.length === 0 && (
        <p className="text-slate-400">
          No career paths available.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {careers.map((career) => (
          <Card
            key={career.id}
            highlighted={selected === career.id}
            className="transition hover:border-indigo-400/50"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Network size={24} aria-hidden="true" />
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

            <Button
              onClick={() => setSelected(career.id)}
              aria-pressed={selected === career.id}
              className="mt-6 w-full"
            >
              {selected === career.id ? 'Selected' : 'Explore path'}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </Card>
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
  const { session } = useAuth()
  const dataKey = session?.user.id ?? 'preview'
  const [menuOpen, setMenuOpen] = useState(false)

  const { pathname } = useLocation()
  const previousPath = useRef(pathname)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    setMenuOpen(false)
    const frame = requestAnimationFrame(() => mainRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)')
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <div className="min-h-screen bg-canvas text-white md:flex">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-xl bg-indigo-600 px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-sidebar p-6 md:flex">
        <Link to="/" className="mb-10 flex items-center gap-3">
          <span className="rounded-xl bg-indigo-600 p-2">
            <Compass size={24} aria-hidden="true" />
          </span>
          <span className="text-xl font-bold">DevAtlas</span>
        </Link>
        <SidebarNavigation />
      </aside>

      <Dialog
        id="mobile-navigation"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="DevAtlas navigation"
        variant="drawer"
      >
        <SidebarNavigation onNavigate={() => {
          setMenuOpen(false)
          requestAnimationFrame(() => mainRef.current?.focus())
        }} />
      </Dialog>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-4 border-b border-white/10 px-6 py-4 md:hidden">
          <Button
            variant="ghost"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={24} aria-hidden="true" />
          </Button>
          <span className="font-bold">DevAtlas</span>
        </header>

        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <Routes>
            <Route
              path="/"
              element={<Dashboard key={dataKey} />}
            />

            <Route
              path="/careers"
              element={<CareerPathsPage key={dataKey} />}
            />

            <Route path="/login" element={<AuthPage key="login" mode="login" />} />
            <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />

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
