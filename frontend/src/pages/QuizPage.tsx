import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useCareers } from '../careers/careerContext'
import Button from '../components/ui/Button'
import { service } from '../services'
import { getQuizView } from '../services/quizView'
import type { QuizResult } from '../types/domain'

type QuizView = Awaited<ReturnType<typeof getQuizView>>

export default function QuizPage() {
  const { skillId = '' } = useParams<{ skillId: string }>()
  const { session } = useAuth()
  return <QuizContent key={`${session?.user.id ?? 'preview'}:${skillId}`} skillId={skillId} />
}

function QuizContent({ skillId }: { skillId: string }) {
  const auth = useAuth()
  const { data, refresh } = useCareers()
  const signedIn = !!auth.session
  const [view, setView] = useState<QuizView>()
  const [loading, setLoading] = useState(true)
  const [readError, setReadError] = useState(false)
  const [reload, setReload] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
  const firstOptions = useRef<Record<string, HTMLInputElement | null>>({})
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const errorFeedback = useRef<HTMLParagraphElement>(null)
  const resultAttemptId = result?.attempt.id

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let active = true
    getQuizView(service, skillId, signedIn).then((value) => {
      if (active) setView(value)
    }).catch(() => {
      if (active) setReadError(true)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [skillId, signedIn, reload])

  useEffect(() => {
    if (resultAttemptId) resultHeading.current?.focus()
  }, [resultAttemptId])

  const quiz = view?.quiz
  const progress = data?.careers.flatMap((career) => career.skills)
    .find((skill) => skill.id === skillId && skill.progress.userId === auth.session?.user.id)?.progress
  const bestScores = [view?.bestScore, progress?.bestQuizScore, result?.attempt.score]
    .filter((score): score is number => typeof score === 'number')
  const bestScore = bestScores.length ? Math.max(...bestScores) : null
  const verified = progress?.verified || view?.attempts.some((attempt) => attempt.passed) || result?.attempt.passed
  const missing = validationAttempted && quiz ? quiz.questions.filter((question) => !answers[question.id]) : []

  async function reconcileProgress() {
    await refresh()
    if (!mounted.current) return
    const value = await getQuizView(service, skillId, signedIn)
    if (mounted.current) setView(value)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || !auth.session || auth.pending || auth.initializing || !quiz || result) return
    setValidationAttempted(true)
    const unanswered = quiz.questions.find((question) => !answers[question.id])
    if (unanswered) {
      firstOptions.current[unanswered.id]?.focus()
      return
    }
    busy.current = true
    setSubmitting(true)
    setSubmitError(false)
    setRefreshError(false)
    const input = {
      quizId: quiz.id,
      responses: quiz.questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })),
    }
    try {
      const recorded = await service.submitQuizAttempt(input)
      if (mounted.current) {
        // The recorded result must remain available even if later refreshes fail.
        setResult(recorded)
        setView((current) => current ? {
          ...current,
          bestScore: Math.max(current.bestScore ?? 0, recorded.attempt.score),
          attempts: current.attempts.some((attempt) => attempt.id === recorded.attempt.id)
            ? current.attempts : [...current.attempts, recorded.attempt],
        } : current)
      }
      try {
        // Shared progress must refresh even after navigation unmounts this quiz.
        await reconcileProgress()
      } catch {
        if (mounted.current) setRefreshError(true)
      }
    } catch {
      if (mounted.current) {
        setSubmitError(true)
        requestAnimationFrame(() => errorFeedback.current?.focus())
      }
    } finally {
      busy.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  async function retryRefresh() {
    if (busy.current) return
    busy.current = true
    setRefreshing(true)
    setRefreshError(false)
    try {
      // This retry reads progress and attempt metadata; it never submits again.
      await reconcileProgress()
    } catch {
      if (mounted.current) setRefreshError(true)
    } finally {
      busy.current = false
      if (mounted.current) setRefreshing(false)
    }
  }

  function retake() {
    if (busy.current) return
    setResult(null)
    setAnswers({})
    setValidationAttempted(false)
    setSubmitError(false)
    requestAnimationFrame(() => {
      if (mounted.current && quiz?.questions[0]) firstOptions.current[quiz.questions[0].id]?.focus()
    })
  }

  const formDisabled = submitting || refreshing || auth.pending || auth.initializing || !signedIn

  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:px-10">
    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">Check your understanding</p>
    <h1 className="mt-4 break-words text-3xl font-bold sm:text-4xl md:text-5xl">{view ? `${view.skill.name} quiz` : 'Practice quiz'}</h1>
    <Link to={`/skills/${encodeURIComponent(skillId)}`} className="my-5 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-300 hover:underline">← Back to skill</Link>
    {loading ? <p role="status" className="py-5 text-slate-400">Loading quiz…</p> : readError ? <div role="alert" className="rounded-2xl border border-red-400/30 p-5 text-red-200">
      <p>Could not load this quiz. Please try again.</p>
      <Button variant="ghost" onClick={() => { setReadError(false); setLoading(true); setReload((value) => value + 1) }} className="mt-3">Retry quiz loading</Button>
    </div> : !view ? <section className="rounded-2xl border border-white/10 bg-surface p-6">
      <h2 className="text-xl font-semibold">Skill not found</h2>
      <p className="mt-3 text-slate-400">Choose an available skill from your learning path.</p>
      <Link to="/learning" className="mt-3 inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">Browse learning skills</Link>
    </section> : !quiz ? <section className="rounded-2xl border border-white/10 bg-surface p-6">
      <h2 className="text-xl font-semibold">No quiz available</h2>
      <p className="mt-3 text-slate-400">There is no practice quiz for this skill yet. You can still explore its learning resources.</p>
    </section> : <>
      <section aria-label="Quiz overview" className="rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
        <p className="leading-7 text-slate-300">{quiz.questions.length} questions, with one answer per question. Pass at {quiz.passThreshold}% or higher. You can retake this quiz as often as you like.</p>
        <p className="mt-3 font-semibold text-indigo-200">{bestScore === null ? 'No attempts yet.' : `Best score: ${bestScore}%`}</p>
        {verified && <p className="mt-3 inline-flex rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-100">Practice quiz verified</p>}
        <p className="mt-3 text-xs leading-6 text-slate-400">Verification is a DevAtlas practice result, not professional certification. Quiz attempts do not change your self-reported learning status.</p>
      </section>

      {!signedIn && <p className="mt-5 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-sm leading-7 text-slate-300">Preview the questions below. <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">Log in</Link> to submit an attempt and keep your results for this mock session.</p>}

      {refreshError && <div role="alert" className="mt-5 rounded-xl border border-amber-400/30 p-4 text-amber-200">
        <p>An attempt was recorded, but your progress could not be refreshed. Retrying this refresh will not submit another attempt.</p>
        <Button variant="ghost" onClick={() => { void retryRefresh() }} disabled={submitting || refreshing} className="mt-3">Retry progress refresh</Button>
      </div>}
      {refreshing && <p role="status" className="mt-4 text-sm text-indigo-200">Refreshing recorded progress…</p>}

      {result ? <section aria-label="Quiz result" className="mt-7 rounded-3xl border border-white/10 bg-surface p-5 sm:p-7">
        <h2 ref={resultHeading} tabIndex={-1} className="text-2xl font-bold">{result.attempt.passed ? 'Quiz passed' : 'Keep practicing'}</h2>
        <p className="mt-4 text-3xl font-bold text-indigo-200">Score: {result.attempt.score}%</p>
        <p className="mt-2 text-sm text-slate-300">{result.attempt.correctCount} of {result.attempt.totalQuestions} correct</p>
        <p className="mt-3 text-sm leading-7 text-slate-400">{result.attempt.passed ? 'You passed this practice quiz. This skill is now quiz verified.' : `This attempt did not reach ${quiz.passThreshold}%. Review the explanations below and try again.`}</p>
        <ol className="mt-6 space-y-4">
          {quiz.questions.map((question, index) => {
            const feedback = result.feedback.find((item) => item.questionId === question.id)
            const selected = question.options.find((option) => option.id === feedback?.selectedOptionId)
            const correct = question.options.find((option) => option.id === feedback?.correctOptionId)
            return <li key={question.id} className="rounded-2xl border border-white/10 p-4">
              <h3 className="font-semibold">{index + 1}. {question.prompt}</h3>
              {feedback ? <>
                <p className={`mt-3 text-sm font-semibold ${feedback.correct ? 'text-emerald-200' : 'text-amber-200'}`}>{feedback.correct ? 'Correct' : 'Incorrect'}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Your answer: {selected?.text ?? 'Unavailable'}</p>
                <p className="mt-2 text-sm leading-6 text-indigo-200">Correct answer: {correct?.text ?? 'Unavailable'}</p>
                <p className="mt-3 text-sm leading-7 text-slate-400">{feedback.explanation}</p>
              </> : <p className="mt-3 text-sm text-slate-400">Feedback is unavailable for this question.</p>}
            </li>
          })}
        </ol>
        <Button onClick={retake} disabled={submitting || refreshing} className="mt-6 w-full sm:w-auto">Retake quiz</Button>
      </section> : <form noValidate onSubmit={(event) => { void submit(event) }} className="mt-7 space-y-5">
        {missing.length > 0 && <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm leading-6 text-red-200">Answer every question before submitting. The first unanswered question is focused.</p>}
        {submitError && <p ref={errorFeedback} role="alert" tabIndex={-1} className="rounded-xl border border-red-400/30 p-4 text-sm leading-6 text-red-200">Could not submit your quiz. Your answers are still selected. Please try submitting again.</p>}
        {quiz.questions.map((question, index) => <fieldset
          key={question.id}
          disabled={formDisabled}
          aria-invalid={validationAttempted && !answers[question.id] ? true : undefined}
          aria-describedby={validationAttempted && !answers[question.id] ? `quiz-error-${question.id}` : undefined}
          className="min-w-0 rounded-2xl border border-white/10 bg-surface px-4 pb-4 pt-2 sm:px-6 sm:pb-6"
        >
          <legend className="max-w-full px-1 font-semibold leading-7">{index + 1}. {question.prompt}</legend>
          <div className="mt-3 space-y-3">{question.options.map((option, optionIndex) => <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-canvas/50 p-3 text-sm leading-7 text-slate-200 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-500/10">
            <input
              ref={optionIndex === 0 ? (input) => { firstOptions.current[question.id] = input } : undefined}
              type="radio"
              name={`quiz-question-${question.id}`}
              value={option.id}
              checked={answers[question.id] === option.id}
              onChange={() => { setAnswers((current) => ({ ...current, [question.id]: option.id })); setSubmitError(false) }}
              required
              className="mt-1 h-5 w-5 shrink-0 accent-indigo-500"
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">{option.text}</span>
          </label>)}</div>
          {validationAttempted && !answers[question.id] && <p id={`quiz-error-${question.id}`} className="mt-3 text-sm text-red-200">Choose an answer for this question.</p>}
        </fieldset>)}
        {signedIn && <Button type="submit" disabled={formDisabled} className="w-full sm:w-auto">{submitting ? 'Submitting quiz…' : 'Submit quiz'}</Button>}
        {submitting && <p role="status" className="text-sm text-indigo-200">Submitting your answers…</p>}
      </form>}
    </>}
  </div>
}
