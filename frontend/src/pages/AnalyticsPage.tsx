import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useCareers } from '../careers/careerContext'
import Button from '../components/ui/Button'
import CareerProgress from '../components/CareerProgress'
import { service } from '../services'
import { getAnalyticsView } from '../services/analyticsView'
import type { CareerDashboard } from '../services/careerDashboard'
import type { SkillStatus } from '../types/domain'

type AnalyticsView = Awaited<ReturnType<typeof getAnalyticsView>>
type Snapshot = {
  source: CareerDashboard | null
  retry: number
  view: AnalyticsView | null
  error: boolean
}

const statusLabels: Record<SkillStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  completed: 'Completed',
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateOnlyFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

function DateLabel({ at }: { at: string }) {
  return <time dateTime={at}>{dateFormatter.format(new Date(at))}</time>
}

function CompletionChart({ series }: { series: AnalyticsView['completionSeries'] }) {
  const titleId = useId()
  const descriptionId = useId()
  if (series.length === 0) return <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-5 text-sm leading-7 text-slate-400">Your completion chart will appear after the first learning status change.</p>

  const width = 700
  const height = 230
  const left = 52
  const right = width - 24
  const top = 20
  const bottom = height - 30
  const earliest = Date.parse(series[0].at)
  const latest = Date.parse(series[series.length - 1].at)
  const points = series.map((point) => ({
    ...point,
    x: earliest === latest ? (left + right) / 2 : left + (Date.parse(point.at) - earliest) / (latest - earliest) * (right - left),
    y: bottom - point.completionPercent / 100 * (bottom - top),
  }))
  // Status changes happen at recorded instants, rather than growing between them.
  const line = points.map((point, index) => index === 0 ? `M ${point.x} ${point.y}` : `H ${point.x} V ${point.y}`).join(' ')

  return <>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} aria-describedby={descriptionId} className="mt-5 h-auto w-full overflow-visible">
      <title id={titleId}>Learning completion over time</title>
      <desc id={descriptionId}>Completed unique skills as a percentage of the whole skill catalogue after each recorded learning status change. Exact dates and values appear in the chart data table below.</desc>
      {[0, 50, 100].map((value) => {
        const y = bottom - value / 100 * (bottom - top)
        return <g key={value}>
          <line x1={left} x2={right} y1={y} y2={y} stroke="#334155" strokeDasharray="4 5" />
          <text x={left - 10} y={y + 4} textAnchor="end" fontSize="13" fill="#cbd5e1">{value}%</text>
        </g>
      })}
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#64748b" />
      <path d={line} fill="none" stroke="#a5b4fc" strokeWidth="3" strokeLinejoin="round" />
      {points.map((point) => <circle key={point.at} cx={point.x} cy={point.y} r="4" fill="#c7d2fe" stroke="#0b1020" strokeWidth="2">
        <title>{dateFormatter.format(new Date(point.at))}: {point.completionPercent}% complete, {point.completedSkills} skills</title>
      </circle>)}
    </svg>
    <div className="flex flex-wrap justify-between gap-3 text-sm text-slate-400">
      <time dateTime={series[0].at}>{dateOnlyFormatter.format(new Date(series[0].at))}</time>
      {series.length > 1 && <time dateTime={series[series.length - 1].at}>{dateOnlyFormatter.format(new Date(series[series.length - 1].at))}</time>}
    </div>
    <div className="mt-5 max-w-full overflow-x-auto rounded-xl border border-white/10">
      <table aria-label="Completion chart data" className="w-full min-w-[30rem] text-left text-sm">
        <caption className="px-4 py-3 text-left font-semibold text-slate-200">Chart data — oldest first</caption>
        <thead className="bg-canvas/70 text-slate-300"><tr><th scope="col" className="px-4 py-3">Date</th><th scope="col" className="px-4 py-3">Completed skills</th><th scope="col" className="px-4 py-3">Completion</th><th scope="col" className="px-4 py-3">Changes recorded</th></tr></thead>
        <tbody className="divide-y divide-white/10 text-slate-300">{series.map((point) => <tr key={point.at}>
          <td className="whitespace-nowrap px-4 py-3"><DateLabel at={point.at} /></td><td className="px-4 py-3">{point.completedSkills}</td><td className="px-4 py-3">{point.completionPercent}%</td><td className="px-4 py-3">{point.eventCount}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </>
}

export default function AnalyticsPage() {
  const { session, initializing } = useAuth()
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:px-10">
    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">See your learning journey</p>
    <h1 className="mt-4 text-4xl font-bold md:text-5xl">Analytics</h1>
    {initializing ? <p role="status" className="mt-7 text-slate-400">Loading analytics…</p> : !session ? <section aria-label="Personal analytics" className="mt-7 rounded-3xl border border-indigo-400/25 bg-indigo-500/10 p-5 sm:p-7">
      <h2 className="text-2xl font-bold">Your progress belongs to you</h2>
      <p className="mt-3 max-w-2xl leading-7 text-slate-300">Log in to see your own learning history, quiz attempts and career progress. Personal analytics are not shown in the public preview.</p>
      <Link to="/login" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">Log in to view analytics</Link>
    </section> : <AnalyticsContent key={session.user.id} userId={session.user.id} />}
  </div>
}

function AnalyticsContent({ userId }: { userId: string }) {
  const { data } = useCareers()
  const [retry, setRetry] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    let active = true
    getAnalyticsView(service).then((view) => {
      if (view.user.id !== userId) throw new Error('Analytics do not belong to the current account.')
      if (active) setSnapshot({ source: data, retry, view, error: false })
    }).catch(() => {
      if (active) setSnapshot({ source: data, retry, view: null, error: true })
    })
    return () => { active = false }
  }, [data, retry, userId])

  // Shared progress refreshes invalidate the rendered snapshot immediately.
  // Cleanup prevents a slower earlier read from publishing over its replacement.
  if (!snapshot || snapshot.source !== data || snapshot.retry !== retry) return <p role="status" className="mt-7 text-slate-400">Loading analytics…</p>
  if (snapshot.error || !snapshot.view) return <div role="alert" className="mt-7 rounded-2xl border border-red-400/30 p-5 text-red-200">
    <p>Could not load your analytics. Please try again.</p>
    <Button variant="ghost" onClick={() => setRetry((value) => value + 1)} className="mt-3">Retry analytics</Button>
  </div>

  const { user, analytics, careers, completionSeries, history, attempts } = snapshot.view
  const completion = analytics.totalSkills ? Math.round(analytics.completedSkills / analytics.totalSkills * 100) : 0

  return <>
    <h2 className="mt-7 break-words text-2xl font-bold">{user.displayName}’s learning overview</h2>
    <p className="mt-3 max-w-3xl leading-7 text-slate-400">These totals include all unique skills in the catalogue, across every career path. Shared skills count once. Per-career progress is listed separately below.</p>
    <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { name: 'Completion', value: `${completion}%`, note: `${analytics.completedSkills} of ${analytics.totalSkills} unique skills completed` },
        { name: 'Learning skills', value: analytics.learningSkills, note: 'Currently marked learning' },
        { name: 'Quiz-verified skills', value: analytics.verifiedSkills, note: 'Passed the practice quiz' },
        { name: 'Quiz attempts', value: analytics.quizzes.attemptCount, note: 'Every recorded attempt' },
      ].map((item) => <div key={item.name} className="min-w-0 rounded-2xl border border-white/10 bg-surface p-4 sm:p-5">
        <dt className="text-sm text-slate-400">{item.name}</dt><dd className="mt-2"><span className="text-3xl font-bold text-indigo-200">{item.value}</span><p className="mt-2 text-xs leading-6 text-slate-400">{item.note}</p></dd>
      </div>)}
    </dl>
    <p className="mt-3 text-xs leading-6 text-slate-400">Completion is self-reported. Quiz verification is independent and records an app practice result, not professional certification.</p>

    <section aria-label="Quiz performance" className="mt-7 rounded-3xl border border-white/10 bg-surface p-5 sm:p-7">
      <h2 className="text-2xl font-bold">Quiz performance</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-3">
        <div><dt className="text-sm text-slate-400">Passed attempts</dt><dd className="mt-2 text-xl font-semibold">{analytics.quizzes.passedCount} of {analytics.quizzes.attemptCount}</dd></div>
        <div><dt className="text-sm text-slate-400">Best score</dt><dd className="mt-2 text-xl font-semibold">{analytics.quizzes.bestScore === null ? 'No score yet' : `${analytics.quizzes.bestScore}%`}</dd></div>
        <div><dt className="text-sm text-slate-400">Average score</dt><dd className="mt-2 text-xl font-semibold">{analytics.quizzes.averageScore === null ? 'No average yet' : `${analytics.quizzes.averageScore}%`}</dd></div>
      </dl>
    </section>

    <section aria-label="Completion over time" className="mt-7 min-w-0 rounded-3xl border border-white/10 bg-surface p-4 sm:p-7">
      <h2 className="text-2xl font-bold">Completion over time</h2>
      <p className="mt-3 text-sm leading-7 text-slate-400">Each point follows a recorded learning status change. The chart does not infer activity before the first event or a timeline for quiz verification.</p>
      <p className="mt-2 break-words text-xs leading-6 text-slate-400">Dates shown in your browser time zone: {browserTimeZone}.</p>
      <CompletionChart series={completionSeries} />
    </section>

    <section aria-label="Career completion" className="mt-8">
      <h2 className="text-2xl font-bold">Progress by career path</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">{careers.map((career) => {
        const progress = analytics.careers.find((item) => item.careerId === career.id)
        if (!progress) return null
        return <article key={career.id} className="min-w-0 rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="text-lg font-bold">{career.name}</h3>
          <p className="mt-3 text-sm text-slate-300">{progress.completedSkills} of {progress.totalSkills} completed · {progress.verifiedSkills} quiz verified</p>
          <CareerProgress label={`${career.name} completion`} value={progress.completionPercent} />
          <p className="mt-3 text-sm font-semibold text-indigo-200">{progress.completionPercent}%</p>
          <Link to={`/graph?path=${encodeURIComponent(career.id)}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-300 hover:underline">Explore skill graph →</Link>
        </article>
      })}</div>
      {careers.length === 0 && <p className="mt-4 text-slate-400">No career paths available.</p>}
    </section>

    <section aria-label="Learning activity" className="mt-8 min-w-0 rounded-3xl border border-white/10 bg-surface p-4 sm:p-7">
      <h2 className="text-2xl font-bold">Learning status history</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Recorded changes for this account, oldest first. Dates use {browserTimeZone}.</p>
      {history.length === 0 ? <p className="mt-5 text-slate-300">No learning history yet.</p> : <div className="mt-4 max-w-full overflow-x-auto rounded-xl border border-white/10">
        <table aria-label="Learning status history" className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-canvas/70 text-slate-300"><tr><th scope="col" className="px-4 py-3">Date</th><th scope="col" className="px-4 py-3">Skill</th><th scope="col" className="px-4 py-3">From</th><th scope="col" className="px-4 py-3">To</th></tr></thead>
          <tbody className="divide-y divide-white/10 text-slate-300">{history.map((event) => <tr key={event.id}>
            <td className="whitespace-nowrap px-4 py-3"><DateLabel at={event.changedAt} /></td><th scope="row" className="px-4 py-3"><Link to={`/skills/${encodeURIComponent(event.skillId)}`} className="inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">{event.skillName}</Link></th><td className="px-4 py-3">{statusLabels[event.fromStatus]}</td><td className="px-4 py-3">{statusLabels[event.toStatus]}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>

    <section aria-label="Quiz activity" className="mt-8 min-w-0 rounded-3xl border border-white/10 bg-surface p-4 sm:p-7">
      <h2 className="text-2xl font-bold">Quiz attempt history</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">All recorded attempts for this account, oldest first. Dates use {browserTimeZone}.</p>
      {attempts.length === 0 ? <p className="mt-5 text-slate-300">No quiz attempts yet.</p> : <div className="mt-4 max-w-full overflow-x-auto rounded-xl border border-white/10">
        <table aria-label="Quiz attempt history" className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-canvas/70 text-slate-300"><tr><th scope="col" className="px-4 py-3">Date</th><th scope="col" className="px-4 py-3">Skill</th><th scope="col" className="px-4 py-3">Correct</th><th scope="col" className="px-4 py-3">Score</th><th scope="col" className="px-4 py-3">Result</th></tr></thead>
          <tbody className="divide-y divide-white/10 text-slate-300">{attempts.map((attempt) => <tr key={attempt.id}>
            <td className="whitespace-nowrap px-4 py-3"><DateLabel at={attempt.submittedAt} /></td><th scope="row" className="px-4 py-3"><Link to={`/skills/${encodeURIComponent(attempt.skillId)}/quiz`} className="inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">{attempt.skillName}</Link></th><td className="px-4 py-3">{attempt.correctCount} of {attempt.totalQuestions}</td><td className="px-4 py-3">{attempt.score}%</td><td className="px-4 py-3">{attempt.passed ? 'Passed' : 'Not passed'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>
}
