import { NavLink } from 'react-router-dom'
import { BarChart3, BookOpen, Compass, LayoutDashboard, Network } from 'lucide-react'

const navigation = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Compass, label: 'Career Paths', path: '/careers' },
  { icon: Network, label: 'Skill Graph', path: '/graph' },
  { icon: BookOpen, label: 'Learning', path: '/learning' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
]

export default function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <nav aria-label="Main navigation" className="space-y-2">
        {navigation.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 transition ${
                isActive
                  ? 'bg-indigo-500/15 font-medium text-indigo-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={19} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4">
        <p className="font-semibold">Your learning journey</p>
        <p className="mt-2 text-sm text-slate-400">
          Explore career paths and discover your next skill.
        </p>
      </div>
    </div>
  )
}
