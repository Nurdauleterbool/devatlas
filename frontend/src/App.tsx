
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import {
  Compass,
  Menu,
} from 'lucide-react'

import { service } from './services'
import PlaceholderPage from './pages/PlaceholderPage'
import CareerPathsPage from './pages/CareerPathsPage'
import SidebarNavigation from './components/SidebarNavigation'
import Button from './components/ui/Button'
import Dialog from './components/ui/Dialog'
import AuthPage from './pages/AuthPage'
import CareerProvider from './careers/CareerProvider'
import DashboardPage from './pages/DashboardPage'
import { useAuth } from './auth/authContext'

const SkillGraphPage = lazy(() => import('./pages/SkillGraphPage'))

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
          {/* Keep pending career writes alive across same-account auth-route visits.
              Auth forms remain siblings so account changes preserve their state. */}
          <CareerProvider key={dataKey} service={service} signedIn={!!session}>
            <Routes>
              <Route path="/login" element={null} />
              <Route path="/signup" element={null} />
              <Route
                path="/"
                element={<DashboardPage />}
              />

              <Route
                path="/careers"
                element={<CareerPathsPage key={dataKey} />}
              />

              <Route
                path="/graph"
                element={<Suspense fallback={<p role="status" className="p-6 text-slate-400">Loading skill graph…</p>}><SkillGraphPage key={dataKey} /></Suspense>}
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
          </CareerProvider>
          <Routes>
            <Route path="/login" element={<AuthPage key="login" mode="login" />} />
            <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
            <Route path="*" element={null} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
