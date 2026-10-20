import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, Circle } from 'lucide-react'
import { useCareers } from '../careers/careerContext'
import CareerSelection, { CareerFeedback } from '../components/CareerSelection'
import CareerProgress from '../components/CareerProgress'
import type { SkillStatus } from '../types/domain'
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
  const { data, loading, error, signedIn } = useCareers()
  const careers = data?.careers ?? []
  const [params, setParams] = useSearchParams()
  const activeId = params.get('path') ?? data?.selectedIds[0]
  const preview = (id: string) => setParams({ path: id }, { replace: true })

  const career = careers.find((item) => item.id === activeId) ?? careers[0]
  const completed = career?.skills.filter((skill) => skill.progress.status === 'completed').length ?? 0
  const total = career?.skills.length ?? 0
  const progress = total ? Math.round((completed / total) * 100) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:px-10">
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

      <CareerFeedback />
      {!loading && !error && (
        <>
          <CareerSelection activeId={career?.id} onPreview={preview} />

          {career && (
            <section aria-labelledby="roadmap-title" className="mt-10 rounded-3xl border border-white/10 bg-surface p-4 sm:p-6 md:p-8">
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

              <CareerProgress value={progress} />

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

                    <p className="mt-3 text-sm text-slate-400">{skill.description}</p>
                    <p className="mt-3 text-xs text-indigo-300">{skill.progress.verified ? 'Practice quiz verified (80% or higher)' : 'Not quiz verified'}</p>
                    <p className="mt-4 text-sm text-slate-400">
                      {skill.prerequisites.length
                        ? `Prerequisites: ${skill.prerequisites.map((item) => item.name).join(', ')}`
                        : 'No prerequisites — start here.'}
                    </p>
                  </Card>
                ))}
              </div>

              <p className="mt-8 text-xs text-slate-400">
                {signedIn ? 'Your current mock account progress. ' : 'Sample demo progress. Log in to save career choices. '}Completion is self-reported; practice quiz verification is independent and is not professional certification.
              </p>
            </section>
          )}

        </>
      )}
    </div>
  )
}
