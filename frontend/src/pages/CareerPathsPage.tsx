import { useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, Circle } from 'lucide-react'
import { service } from '../services'
import type { SkillStatus } from '../types/domain'
import { useCareerRoadmaps } from '../hooks/useCareerRoadmaps'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

const statusLabels: Record<SkillStatus, string> = {
  not_started: 'Not Started',
  learning: 'Learning',
  completed: 'Completed',
}

const statusColors: Record<SkillStatus, string> = {
  not_started: 'text-slate-400 bg-slate-500/10',
  learning: 'text-amber-300 bg-amber-500/10',
  completed: 'text-emerald-300 bg-emerald-500/10',
}

function StatusIcon({ status }: { status: SkillStatus }) {
  if (status === 'completed') return <CheckCircle2 size={17} aria-hidden="true" />
  if (status === 'learning') return <Clock3 size={17} aria-hidden="true" />
  return <Circle size={17} aria-hidden="true" />
}

export default function CareerPathsPage() {
  const { careers, loading, error } = useCareerRoadmaps(service)
  const [activeId, setActiveId] = useState('frontend')

  const career = careers.find((item) => item.id === activeId) ?? careers[0]
  const completed = career?.skills.filter((skill) => skill.progress.status === 'completed').length ?? 0
  const total = career?.skills.length ?? 0
  const progress = total ? Math.round((completed / total) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
        Explore your future
      </p>

      <h1 className="mt-4 text-4xl font-bold md:text-5xl">
        Career Paths
      </h1>

      <p className="mt-4 max-w-2xl text-slate-400">
        Choose an IT career and see which skills you need to learn.
        Track your progress and explore your next steps.
      </p>

      {loading && <p role="status" className="mt-8 text-slate-400">Loading career paths...</p>}
      {error && <p role="alert" className="mt-8 text-red-400">Could not load career paths.</p>}

      {!loading && !error && (
        <>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {careers.map((item) => (
              <Button
                variant="ghost"
                key={item.id}
                onClick={() => setActiveId(item.id)}
                aria-pressed={career?.id === item.id}
                className={`flex-col items-start border text-left ${
                  career?.id === item.id
                    ? 'border-indigo-400 bg-indigo-500/15'
                    : 'border-white/10 bg-surface hover:border-indigo-400/50'
                }`}
              >
                <span className="text-lg font-semibold text-slate-100">{item.name}</span>
                <span className="mt-2 text-sm font-normal text-slate-400">{item.description}</span>
                <span className="mt-4 text-sm text-indigo-300">
                  {item.skills.length} skills <ArrowRight size={15} className="ml-1 inline" aria-hidden="true" />
                </span>
              </Button>
            ))}
          </div>

          {career && (
            <section aria-labelledby="roadmap-title" className="mt-10 rounded-3xl border border-white/10 bg-surface p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-sm text-indigo-400">Your roadmap</p>
                  <h2 id="roadmap-title" className="mt-2 text-2xl font-bold">{career.name}</h2>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-indigo-300">{progress}%</p>
                  <p className="text-sm text-slate-400">{completed} of {total} completed</p>
                </div>
              </div>

              <div
                className="mt-6 h-3 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Career progress"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <h3 className="mt-10 text-lg font-semibold">Required skills</h3>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {career.skills.map((skill) => (
                  <Card
                    key={skill.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold">{skill.name}</h4>
                      <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${statusColors[skill.progress.status]}`}>
                        <StatusIcon status={skill.progress.status} />
                        {statusLabels[skill.progress.status]}
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-slate-400">
                      {skill.prerequisites.length
                        ? `Prerequisites: ${skill.prerequisites.map((item) => item.name).join(', ')}`
                        : 'No prerequisites — start here.'}
                    </p>
                  </Card>
                ))}
              </div>

              <p className="mt-8 text-xs text-slate-400">
                Demo progress shown. Personal progress tracking will be connected later.
              </p>
            </section>
          )}

          {careers.length === 0 && (
            <p className="mt-8 text-slate-400">No career paths available.</p>
          )}
        </>
      )}
    </div>
  )
}
