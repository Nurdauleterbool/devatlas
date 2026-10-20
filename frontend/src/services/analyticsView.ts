import type { Analytics, CareerPath, ProgressEvent, QuizAttempt, SkillStatus, User } from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'

export interface AnalyticsView {
  user: User
  analytics: Analytics
  careers: CareerPath[]
  history: (ProgressEvent & { skillName: string })[]
  attempts: (QuizAttempt & { skillName: string })[]
  completionSeries: { at: string; completedSkills: number; completionPercent: number; eventCount: number }[]
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const status = (value: unknown): value is SkillStatus => ['not_started', 'learning', 'completed'].includes(value as string)
const validTime = (value: unknown): value is string => nonempty(value) && Number.isFinite(Date.parse(value))
const percentage = (completed: number, total: number) => total ? Math.round(completed / total * 100) : 0
function invalid(message: string): never {
  throw new ServiceError('VALIDATION', message)
}
function copyEvent(event: ProgressEvent): ProgressEvent {
  return {
    id: event.id, userId: event.userId, skillId: event.skillId,
    fromStatus: event.fromStatus, toStatus: event.toStatus, changedAt: event.changedAt,
  }
}

/** Join an authenticated snapshot; chart points use observed event times, never a fabricated baseline. */
export async function getAnalyticsView(service: DevAtlasService): Promise<AnalyticsView> {
  const [current, analytics, skills, paths, progress, records] = await Promise.all([
    service.getCurrentUser(), service.getAnalytics(), service.getSkills(),
    service.getCareerPaths(), service.getProgress(), service.getQuizAttempts(),
  ])
  if (!current || !nonempty(current.id) || !nonempty(current.displayName) || !nonempty(current.email) || !validTime(current.createdAt)) {
    invalid('Analytics require a valid current user.')
  }
  if (!analytics || analytics.userId !== current.id || !Array.isArray(analytics.history)
    || !Array.isArray(analytics.careers) || !analytics.quizzes
    || ![skills, paths, progress, records].every(Array.isArray)) {
    invalid('Analytics contain a malformed or foreign snapshot.')
  }
  const user: User = { id: current.id, displayName: current.displayName, email: current.email, createdAt: current.createdAt }
  const skillMap = new Map<string, string>()
  for (const skill of skills) {
    if (!skill || !nonempty(skill.id) || !nonempty(skill.name) || skillMap.has(skill.id)) {
      invalid('Analytics contain a malformed or duplicate skill.')
    }
    skillMap.set(skill.id, skill.name)
  }
  const progressMap = new Map<string, typeof progress[number]>()
  for (const record of progress) {
    if (!record || record.userId !== user.id || !skillMap.has(record.skillId) || progressMap.has(record.skillId)
      || !status(record.status) || typeof record.verified !== 'boolean' || !validTime(record.updatedAt)
      || (record.bestQuizScore !== null && (!Number.isFinite(record.bestQuizScore) || record.bestQuizScore < 0 || record.bestQuizScore > 100))) {
      invalid('Analytics contain invalid or foreign current progress.')
    }
    progressMap.set(record.skillId, record)
  }
  if (progressMap.size !== skillMap.size) invalid('Analytics are missing current skill progress.')
  const completed = progress.filter((record) => record.status === 'completed').length
  const learning = progress.filter((record) => record.status === 'learning').length
  const verified = progress.filter((record) => record.verified).length
  if (analytics.totalSkills !== skillMap.size || analytics.completedSkills !== completed
    || analytics.learningSkills !== learning || analytics.verifiedSkills !== verified) {
    invalid('Analytics summary does not match current unique-skill progress.')
  }

  const careerIds = new Set<string>()
  const careers = paths.map((path): CareerPath => {
    if (!path || !nonempty(path.id) || !nonempty(path.name) || typeof path.description !== 'string'
      || careerIds.has(path.id) || !Array.isArray(path.skillIds)
      || new Set(path.skillIds).size !== path.skillIds.length || path.skillIds.some((id) => !skillMap.has(id))) {
      invalid('Analytics contain an invalid career reference.')
    }
    careerIds.add(path.id)
    return { id: path.id, name: path.name, description: path.description, skillIds: [...path.skillIds] }
  })
  const summaryIds = new Set<string>()
  for (const summary of analytics.careers) {
    const path = summary && careers.find((career) => career.id === summary.careerId)
    if (!path || summaryIds.has(summary.careerId)) invalid('Analytics contain an invalid career summary.')
    summaryIds.add(summary.careerId)
    const complete = path.skillIds.filter((id) => progressMap.get(id)!.status === 'completed').length
    const verified = path.skillIds.filter((id) => progressMap.get(id)!.verified).length
    if (summary.totalSkills !== path.skillIds.length || summary.completedSkills !== complete
      || summary.verifiedSkills !== verified || summary.completionPercent !== percentage(complete, path.skillIds.length)) {
      invalid('Analytics career summary does not match progress.')
    }
  }
  if (summaryIds.size !== careers.length) invalid('Analytics are missing a career summary.')

  const seenEvents = new Set<string>()
  const history = analytics.history.map((event, order) => {
    if (!event || !nonempty(event.id) || seenEvents.has(event.id) || event.userId !== user.id
      || !skillMap.has(event.skillId) || !status(event.fromStatus) || !status(event.toStatus)
      || event.fromStatus === event.toStatus || !validTime(event.changedAt)) {
      invalid('Analytics contain an invalid or foreign history event.')
    }
    seenEvents.add(event.id)
    return { event: copyEvent(event), order }
  }).sort((a, b) => Date.parse(a.event.changedAt) - Date.parse(b.event.changedAt) || a.order - b.order)
    .map(({ event }) => ({ ...event, skillName: skillMap.get(event.skillId)! }))

  // Reverse from observed current statuses to check chains without assuming an all-zero initial state.
  const states = new Map(progress.map((record) => [record.skillId, record.status]))
  for (const event of [...history].reverse()) {
    if (states.get(event.skillId) !== event.toStatus) invalid('Analytics history does not match current progress or its event chain.')
    states.set(event.skillId, event.fromStatus)
  }
  const delta = (event: ProgressEvent) => Number(event.toStatus === 'completed') - Number(event.fromStatus === 'completed')
  let completedAt = completed - history.reduce((sum, event) => sum + delta(event), 0)
  if (completedAt < 0 || completedAt > skills.length) invalid('Analytics history has an invalid completion baseline.')
  const completionSeries: AnalyticsView['completionSeries'] = []
  for (const event of history) {
    completedAt += delta(event)
    if (completedAt < 0 || completedAt > skills.length) invalid('Analytics history has invalid completion counts.')
    const previous = completionSeries.at(-1)
    if (previous && Date.parse(previous.at) === Date.parse(event.changedAt)) {
      previous.completedSkills = completedAt
      previous.completionPercent = percentage(completedAt, skills.length)
      previous.eventCount++
    } else {
      completionSeries.push({ at: event.changedAt, completedSkills: completedAt, completionPercent: percentage(completedAt, skills.length), eventCount: 1 })
    }
  }

  const seenAttempts = new Set<string>()
  const attempts = records.map((attempt, order) => {
    if (!attempt || !nonempty(attempt.id) || seenAttempts.has(attempt.id) || attempt.userId !== user.id
      || !skillMap.has(attempt.skillId) || !nonempty(attempt.quizId)
      || !Number.isInteger(attempt.totalQuestions) || attempt.totalQuestions < 5 || attempt.totalQuestions > 10
      || !Number.isInteger(attempt.correctCount) || attempt.correctCount < 0 || attempt.correctCount > attempt.totalQuestions
      || !Number.isFinite(attempt.score) || attempt.score !== percentage(attempt.correctCount, attempt.totalQuestions)
      || typeof attempt.passed !== 'boolean' || attempt.passed !== (attempt.correctCount / attempt.totalQuestions >= 0.8)
      || !validTime(attempt.submittedAt) || !Array.isArray(attempt.responses) || attempt.responses.length !== attempt.totalQuestions) {
      invalid('Analytics contain an invalid or foreign quiz attempt.')
    }
    seenAttempts.add(attempt.id)
    const questions = new Set<string>()
    const responses = attempt.responses.map((response) => {
      if (!response || !nonempty(response.questionId) || !nonempty(response.optionId) || questions.has(response.questionId)) {
        invalid('Analytics contain invalid quiz responses.')
      }
      questions.add(response.questionId)
      return { questionId: response.questionId, optionId: response.optionId }
    })
    const copied: QuizAttempt & { skillName: string } = {
      id: attempt.id, userId: attempt.userId, quizId: attempt.quizId, skillId: attempt.skillId,
      correctCount: attempt.correctCount, totalQuestions: attempt.totalQuestions,
      score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt,
      responses, skillName: skillMap.get(attempt.skillId)!,
    }
    return { attempt: copied, order }
  }).sort((a, b) => Date.parse(a.attempt.submittedAt) - Date.parse(b.attempt.submittedAt) || a.order - b.order)
    .map(({ attempt }) => attempt)
  const best = attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null
  const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : null
  if (analytics.quizzes.attemptCount !== attempts.length || analytics.quizzes.passedCount !== attempts.filter((attempt) => attempt.passed).length
    || analytics.quizzes.bestScore !== best || analytics.quizzes.averageScore !== average) {
    invalid('Analytics quiz summary does not match the retained attempts.')
  }
  for (const record of progress) {
    const ownAttempts = attempts.filter((attempt) => attempt.skillId === record.skillId)
    const bestScore = ownAttempts.length ? Math.max(...ownAttempts.map((attempt) => attempt.score)) : null
    if (record.verified !== ownAttempts.some((attempt) => attempt.passed) || record.bestQuizScore !== bestScore) {
      invalid('Analytics verification does not match retained quiz attempts.')
    }
  }
  return {
    user, careers, history, attempts, completionSeries,
    analytics: {
      userId: analytics.userId, totalSkills: analytics.totalSkills, completedSkills: analytics.completedSkills,
      learningSkills: analytics.learningSkills, verifiedSkills: analytics.verifiedSkills,
      careers: analytics.careers.map((summary) => ({
        careerId: summary.careerId, totalSkills: summary.totalSkills, completedSkills: summary.completedSkills,
        verifiedSkills: summary.verifiedSkills, completionPercent: summary.completionPercent,
      })),
      quizzes: { attemptCount: analytics.quizzes.attemptCount, passedCount: analytics.quizzes.passedCount, bestScore: best, averageScore: average },
      history: history.map(copyEvent),
    },
  }
}
