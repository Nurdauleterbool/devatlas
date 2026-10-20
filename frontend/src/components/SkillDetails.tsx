import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useCareers } from '../careers/careerContext'
import { service } from '../services'
import { getSkillDetails } from '../services/skillDetails'
import type { SkillStatus } from '../types/domain'
import Button from './ui/Button'

type Details = Awaited<ReturnType<typeof getSkillDetails>>
type SkillDetailsProps = {
  skillId: string
  onNavigate?: (id: string) => void
}

const statusLabels: Record<SkillStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  completed: 'Completed',
}

export default function SkillDetails(props: SkillDetailsProps) {
  const { session } = useAuth()
  // A skill/account change gets a clean request lifecycle and no old private state.
  return <SkillDetailsContent key={`${session?.user.id ?? 'preview'}:${props.skillId}`} {...props} />
}

function SkillDetailsContent({ skillId, onNavigate }: SkillDetailsProps) {
  const auth = useAuth()
  const { data, updateProgress, refresh } = useCareers()
  const [details, setDetails] = useState<Details>()
  const [loading, setLoading] = useState(true)
  const [readError, setReadError] = useState(false)
  const [reload, setReload] = useState(0)
  const [draftStatus, setDraftStatus] = useState<SkillStatus | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saved, setSaved] = useState(false)
  const mounted = useRef(true)
  const busy = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const loadedSkillId = details?.skill.id
  const inDialog = !!onNavigate
  const workspaceProgress = data?.careers.flatMap((career) => career.skills)
    .find((skill) => skill.id === skillId && skill.progress.userId === details?.progress.userId)?.progress
  // Another view may finish a save after this view has read its initial details.
  // Confirmed progress follows the newer shared snapshot; unsaved input stays local.
  const confirmedProgress = details && workspaceProgress
    && Date.parse(workspaceProgress.updatedAt) >= Date.parse(details.progress.updatedAt)
    ? workspaceProgress : details?.progress
  const status = draftStatus ?? confirmedProgress?.status ?? 'not_started'

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let active = true
    getSkillDetails(service, skillId).then((value) => {
      if (!active) return
      setDetails(value)
    }).catch(() => {
      if (active) setReadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [skillId, reload])

  useEffect(() => {
    // Replacing modal content must put keyboard focus into the newly loaded skill.
    if (inDialog && loadedSkillId && !loading && !readError) headingRef.current?.focus()
  }, [loadedSkillId, loading, readError, inDialog])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !auth.session || auth.pending || auth.initializing || !details) return
    busy.current = true
    setSaving(true)
    setSaved(false)
    setSaveError(false)
    const intendedStatus = status
    try {
      await updateProgress({ skillId, status: intendedStatus })
      // Refresh the shared workspace even if this view was left during the write.
      // The provider owns account/unmount guards for its own cached data.
      await refresh()
      if (!mounted.current) return
      const value = await getSkillDetails(service, skillId)
      if (!mounted.current) return
      setDetails(value)
      setDraftStatus(null)
      setSaved(true)
      requestAnimationFrame(() => feedbackRef.current?.focus())
    } catch {
      if (mounted.current) {
        setSaveError(true)
        requestAnimationFrame(() => feedbackRef.current?.focus())
      }
    } finally {
      busy.current = false
      if (mounted.current) setSaving(false)
    }
  }

  if (loading) return <p role="status" className="py-4 text-slate-400">Loading skill details…</p>
  if (readError) return <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-red-200">
    <p>Could not load this skill. Please try again.</p>
    <Button variant="ghost" onClick={() => { setLoading(true); setReadError(false); setReload((value) => value + 1) }} className="mt-3">Retry skill details</Button>
  </div>
  if (!details) return <div className="py-4">
    <h2 className="text-xl font-semibold">Skill not found</h2>
    <p className="mt-3 leading-7 text-slate-400">This skill is unavailable. Choose another skill from your learning path.</p>
    <Link to="/learning" className="mt-3 inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">Browse learning skills</Link>
  </div>

  const name = details.skill.name
  const progress = confirmedProgress ?? details.progress
  const heading = onNavigate
    ? <h3 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">{name}</h3>
    : <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">{name}</h2>
  const disabled = saving || auth.pending || auth.initializing

  return <div className="min-w-0 space-y-7">
    <section>
      {heading}
      <p className="mt-3 leading-7 text-slate-300">{details.skill.description}</p>
      {!auth.session && <p className="mt-3 text-sm leading-6 text-slate-400">Sample demo progress. <Link to="/login" className="font-semibold text-indigo-300 hover:underline">Log in</Link> to update your learning status.</p>}
    </section>

    <section aria-label="Skill prerequisites">
      <h3 className="text-lg font-semibold">Prerequisites</h3>
      {details.prerequisites.length === 0 ? <p className="mt-2 text-sm leading-6 text-slate-400">No prerequisites. You can start here.</p> : <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {details.prerequisites.map((skill) => <li key={skill.id}>
          {onNavigate ? <Button variant="ghost" onClick={() => onNavigate(skill.id)} className="!px-0 text-indigo-300">{skill.name}</Button> : <Link to={`/skills/${encodeURIComponent(skill.id)}`} className="inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">{skill.name}</Link>}
        </li>)}
      </ul>}
    </section>

    <section aria-label="Skill learning progress" className="rounded-2xl border border-white/10 bg-canvas/50 p-4 sm:p-5">
      <h3 className="text-lg font-semibold">Your learning progress</h3>
      <p className="mt-3 text-sm text-slate-300">Current status: {statusLabels[progress.status]}</p>
      <p className="mt-2 text-sm text-indigo-200">{progress.verified ? 'Practice quiz verified (80% or higher).' : 'Not quiz verified.'}</p>
      <p className="mt-2 text-sm text-slate-400">{progress.bestQuizScore === null ? 'No quiz attempts yet.' : `Best quiz score: ${progress.bestQuizScore}%.`}</p>
      <p className="mt-3 text-xs leading-6 text-slate-400">Self-assessment and quiz verification are independent. You can record existing knowledge regardless of prerequisites. Verification is an app practice result, not professional certification.</p>
      {auth.session && <form onSubmit={(event) => { void save(event) }} className="mt-5">
        <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3">
          <label htmlFor={`learning-status-${skillId}`} className="text-sm font-semibold">Learning status</label>
          <select
            id={`learning-status-${skillId}`}
            value={status}
            onChange={(event) => { setDraftStatus(event.target.value as SkillStatus); setSaved(false) }}
            className="min-h-11 w-full rounded-xl border border-white/20 bg-surface px-3 py-3 text-base disabled:opacity-50"
          >
            {(Object.keys(statusLabels) as SkillStatus[]).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select>
          <Button type="submit" disabled={disabled}>{saving ? 'Saving learning status…' : 'Save learning status'}</Button>
        </fieldset>
        {saving && <p role="status" className="mt-3 text-sm text-indigo-200">Saving your learning status…</p>}
        {saved && <p ref={feedbackRef} role="status" tabIndex={-1} className="mt-3 text-sm text-emerald-200">Learning status saved.</p>}
        {saveError && <p ref={feedbackRef} role="alert" tabIndex={-1} className="mt-3 text-sm leading-6 text-red-200">Could not save or refresh your learning status. Your change may already be saved. Choose Save learning status to retry.</p>}
      </form>}
    </section>

    <section aria-label="Free learning resources">
      <h3 className="text-lg font-semibold">Free learning resources</h3>
      {details.resources.length ? <ul className="mt-3 space-y-3">{details.resources.map((resource) => <li key={resource.id} className="rounded-xl border border-white/10 p-3">
        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-words font-semibold text-indigo-300 hover:underline">{resource.title}<span className="sr-only"> (opens in a new tab)</span></a>
        <p className="mt-1 text-xs capitalize text-slate-400">Free {resource.kind}</p>
      </li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No free learning resources available yet.</p>}
      {details.unavailableResourceCount > 0 && <p className="mt-3 text-sm text-slate-400">Some learning resources are unavailable.</p>}
    </section>

    <section aria-label="Practice exercise">
      <h3 className="text-lg font-semibold">Practice exercise</h3>
      {details.practiceTasks.length ? <ul className="mt-3 space-y-3">{details.practiceTasks.map((task) => <li key={task.id} className="rounded-xl border border-white/10 p-4">
        <h4 className="font-semibold">{task.title}</h4>
        <p className="mt-2 text-sm leading-7 text-slate-300">{task.description}</p>
      </li>)}</ul> : <p className="mt-2 text-sm text-slate-400">No practice exercise available yet.</p>}
    </section>

    <section aria-label="Practice quiz">
      <h3 className="text-lg font-semibold">Check your knowledge</h3>
      {details.quiz ? <>
        <p className="mt-2 text-sm leading-6 text-slate-400">{details.quiz.questions.length} questions. Pass at {details.quiz.passThreshold}% to verify this skill in DevAtlas.</p>
        <Link to={`/skills/${encodeURIComponent(skillId)}/quiz`} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">Take practice quiz</Link>
      </> : <p className="mt-2 text-sm text-slate-400">No practice quiz available yet.</p>}
    </section>
  </div>
}
