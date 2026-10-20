import { ServiceError } from '../DevAtlasService'
import type { MockFixtures } from './index'

const statuses = new Set(['not_started', 'learning', 'completed'])

/** Validate catalogue references and grading data before creating mutable mock state. */
export function validateFixtures(seed: MockFixtures): void {
  function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new ServiceError('VALIDATION', `Invalid fixtures: ${message}`)
  }
  function ids(items: { id: string }[], label: string) {
    const values = items.map((item) => item.id)
    check(values.every((id) => typeof id === 'string' && id.trim().length > 0), `${label} IDs must be nonempty`)
    check(new Set(values).size === values.length, `duplicate ${label} ID`)
    return new Set(values)
  }
  function timestamp(value: string) {
    check(typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'timestamp must be canonical UTC ISO 8601')
  }
  const userIds = ids(seed.users, 'user')
  const careerIds = ids(seed.careerPaths, 'career')
  const skillIds = ids(seed.skills, 'skill')
  ids(seed.learningResources, 'resource')
  ids(seed.practiceTasks, 'practice task')
  ids(seed.quizzes, 'quiz')
  ids(seed.attempts, 'attempt')
  ids(seed.history, 'history')
  seed.users.forEach((user) => timestamp(user.createdAt))

  const edges = new Set<string>()
  const parents = new Map<string, string[]>()
  for (const edge of seed.dependencies) {
    check(skillIds.has(edge.skillId) && skillIds.has(edge.prerequisiteId), 'unknown dependency skill')
    const key = `${edge.skillId}:${edge.prerequisiteId}`
    check(!edges.has(key), 'duplicate dependency')
    edges.add(key)
    parents.set(edge.skillId, [...(parents.get(edge.skillId) ?? []), edge.prerequisiteId])
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string) {
    check(!visiting.has(id), 'dependency cycle')
    if (visited.has(id)) return
    visiting.add(id)
    for (const parent of parents.get(id) ?? []) visit(parent)
    visiting.delete(id)
    visited.add(id)
  }
  skillIds.forEach(visit)
  for (const career of seed.careerPaths) {
    check(new Set(career.skillIds).size === career.skillIds.length, 'duplicate career skill')
    for (const id of career.skillIds) {
      check(skillIds.has(id), 'unknown career skill')
      check((parents.get(id) ?? []).every((parent) => career.skillIds.includes(parent)), 'career omits a prerequisite')
    }
  }
  for (const resource of seed.learningResources) {
    check(skillIds.has(resource.skillId), 'unknown resource skill')
    let url: URL
    try { url = new URL(resource.url) } catch { check(false, 'invalid resource URL') }
    check(url!.protocol === 'https:', 'resource URL must use HTTPS')
  }
  seed.practiceTasks.forEach((task) => check(skillIds.has(task.skillId), 'unknown practice skill'))

  const questions = new Set<string>()
  const quizSkills = new Set<string>()
  for (const quiz of seed.quizzes) {
    check(skillIds.has(quiz.skillId), 'unknown quiz skill')
    check(!quizSkills.has(quiz.skillId), 'duplicate quiz for skill')
    quizSkills.add(quiz.skillId)
    check(quiz.passThreshold === 80, 'quiz threshold must be 80 percent')
    check(quiz.questions.length >= 5 && quiz.questions.length <= 10, 'quiz must have 5–10 questions')
    for (const question of quiz.questions) {
      check(!questions.has(question.id), 'duplicate question ID')
      questions.add(question.id)
      check(question.options.length === 4, 'question must have four options')
      const optionIds = ids(question.options, 'answer option')
      check(new Set(question.options.map((option) => option.text)).size === 4, 'duplicate option text')
      const key = seed.answerKeys[question.id]
      check(key && optionIds.has(key.correctOptionId) && key.explanation.trim(), 'missing or invalid answer key')
    }
  }
  check(Object.keys(seed.answerKeys).every((id) => questions.has(id)), 'orphan answer key')

  const progressKeys = new Set<string>()
  for (const progress of seed.progress) {
    check(userIds.has(progress.userId) && skillIds.has(progress.skillId), 'unknown progress owner or skill')
    check(statuses.has(progress.status), 'invalid progress status')
    const key = `${progress.userId}:${progress.skillId}`
    check(!progressKeys.has(key), 'duplicate user progress')
    progressKeys.add(key)
    timestamp(progress.updatedAt)
  }
  const latestStatuses = new Map<string, string>()
  for (const event of [...seed.history].sort((a, b) => a.changedAt.localeCompare(b.changedAt))) {
    check(userIds.has(event.userId) && skillIds.has(event.skillId), 'unknown history owner or skill')
    check(statuses.has(event.fromStatus) && statuses.has(event.toStatus), 'invalid history status')
    const key = `${event.userId}:${event.skillId}`
    check(event.fromStatus === (latestStatuses.get(key) ?? 'not_started'), 'history status does not follow previous event')
    check(event.fromStatus !== event.toStatus, 'history contains an unchanged status')
    latestStatuses.set(key, event.toStatus)
    timestamp(event.changedAt)
  }
  for (const progress of seed.progress) {
    check(progress.status === (latestStatuses.get(`${progress.userId}:${progress.skillId}`) ?? 'not_started'), 'progress does not match history')
  }
  for (const [key, status] of latestStatuses) {
    check(status === (seed.progress.find((item) => `${item.userId}:${item.skillId}` === key)?.status ?? 'not_started'), 'history has no matching progress')
  }
  for (const attempt of seed.attempts) {
    const quiz = seed.quizzes.find((item) => item.id === attempt.quizId)
    check(userIds.has(attempt.userId) && quiz && quiz.skillId === attempt.skillId, 'unknown attempt owner or quiz')
    check(attempt.responses.length === quiz.questions.length, 'incomplete attempt')
    check(new Set(attempt.responses.map((response) => response.questionId)).size === quiz.questions.length, 'duplicate attempt response')
    let correct = 0
    for (const response of attempt.responses) {
      const question = quiz.questions.find((item) => item.id === response.questionId)
      check(question && question.options.some((option) => option.id === response.optionId), 'invalid attempt response')
      if (seed.answerKeys[question.id].correctOptionId === response.optionId) correct++
    }
    check(attempt.totalQuestions === quiz.questions.length && attempt.correctCount === correct, 'incorrect attempt counts')
    check(attempt.score === Math.round(correct / quiz.questions.length * 100), 'incorrect attempt score')
    check(attempt.passed === (correct / quiz.questions.length >= quiz.passThreshold / 100), 'incorrect attempt outcome')
    timestamp(attempt.submittedAt)
  }
  const selections = new Set<string>()
  for (const selection of seed.selectedCareers) {
    check(userIds.has(selection.userId) && careerIds.has(selection.careerId), 'unknown selection owner or career')
    const key = `${selection.userId}:${selection.careerId}`
    check(!selections.has(key), 'duplicate career selection')
    selections.add(key)
    timestamp(selection.selectedAt)
  }
}
