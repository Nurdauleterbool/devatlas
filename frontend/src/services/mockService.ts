import type {
  Analytics, QuizResult, Recommendation, SkillStatus, UserSkillProgress,
} from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'
import { seedFixtures } from './fixtures'
import type { MockFixtures } from './fixtures'
import { DEMO_USER_ID } from './fixtures/catalog'
import { validateFixtures } from './fixtures/validateFixtures'

export type MockScenario = 'success' | 'empty' | 'error'

export interface MockServiceOptions {
  scenario?: MockScenario
  latencyMs?: number
  failMethods?: (keyof DevAtlasService)[]
  userId?: string
  fixtures?: MockFixtures
  now?: () => Date
}

function invalid(message: string): never {
  throw new ServiceError('VALIDATION', message)
}

function identifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${label} must be a nonempty string.`)
}

function fields(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Request must be an object.')
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid('Request contains unsupported fields.')
}

/** An isolated, session-scoped in-memory implementation of the frontend contract. */
export function createMockService(options: MockServiceOptions = {}): DevAtlasService {
  const { latencyMs = 0, scenario = 'success', userId = DEMO_USER_ID, now = () => new Date() } = options
  if (!Number.isFinite(latencyMs) || latencyMs < 0) invalid('latencyMs must be a finite nonnegative number.')
  if (!['success', 'empty', 'error'].includes(scenario)) invalid('Unknown mock scenario.')
  const failMethods = new Set(options.failMethods ?? [])
  const state = structuredClone(options.fixtures ?? seedFixtures)
  validateFixtures(state)
  const currentUser = state.users.find((user) => user.id === userId)
  if (!currentUser) throw new ServiceError('NOT_FOUND', 'Mock session user was not found.')
  const userCreatedAt = currentUser.createdAt

  // Empty is a coherent empty catalogue, not a successful write with an impossible empty response.
  if (scenario === 'empty') {
    state.careerPaths = []
    state.skills = []
    state.dependencies = []
    state.learningResources = []
    state.practiceTasks = []
    state.quizzes = []
    state.answerKeys = {}
    state.progress = []
    state.history = []
    state.attempts = []
    state.selectedCareers = []
  }

  let sequence = 0
  const usedIds = new Set([...state.history, ...state.attempts].map((item) => item.id))
  function nextId(prefix: string) {
    let id: string
    do { id = `${prefix}-${++sequence}` } while (usedIds.has(id))
    usedIds.add(id)
    return id
  }
  function timestamp() {
    const date = now()
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) invalid('Mock clock must return a valid Date.')
    return date.toISOString()
  }
  function skill(id: string) {
    identifier(id, 'Skill ID')
    const value = state.skills.find((item) => item.id === id)
    if (!value) throw new ServiceError('NOT_FOUND', `Skill not found: ${id}`)
    return value
  }
  function career(id: string) {
    identifier(id, 'Career ID')
    const value = state.careerPaths.find((item) => item.id === id)
    if (!value) throw new ServiceError('NOT_FOUND', `Career path not found: ${id}`)
    return value
  }
  function attemptsForUser() {
    return state.attempts.filter((attempt) => attempt.userId === userId)
  }
  function historyForUser() {
    return state.history.filter((event) => event.userId === userId)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
  }
  function progressForSkill(skillId: string): UserSkillProgress {
    const record = state.progress.find((item) => item.userId === userId && item.skillId === skillId)
    const attempts = attemptsForUser().filter((attempt) => attempt.skillId === skillId)
    return {
      userId, skillId, status: record?.status ?? 'not_started',
      updatedAt: [record?.updatedAt ?? userCreatedAt, ...attempts.map((attempt) => attempt.submittedAt)].sort().at(-1)!,
      verified: attempts.some((attempt) => attempt.passed),
      bestQuizScore: attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null,
    }
  }
  function progressForUser() {
    return state.skills.map((item) => progressForSkill(item.id))
  }

  async function request<Input, Output>(method: keyof DevAtlasService, input: Input, run: (value: Input) => Output): Promise<Output> {
    // Copy before awaiting so callers cannot change a pending mutation's payload.
    let snapshot: Input
    try {
      snapshot = structuredClone(input)
    } catch {
      invalid('Request must contain cloneable data.')
    }
    if (latencyMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, latencyMs))
    else await Promise.resolve()
    if (scenario === 'error' || failMethods.has(method)) {
      throw new ServiceError('UNAVAILABLE', `Mock request failed: ${method}`)
    }
    return structuredClone(run(snapshot))
  }

  const service: DevAtlasService = {
    getCurrentUser: () => request('getCurrentUser', undefined, () => currentUser),
    getCareerPaths: () => request('getCareerPaths', undefined, () => state.careerPaths),
    getCareerPath: (id) => request('getCareerPath', id, (value) => {
      identifier(value, 'Career ID')
      return state.careerPaths.find((item) => item.id === value)
    }),
    getSkills: () => request('getSkills', undefined, () => state.skills),
    getSkill: (id) => request('getSkill', id, (value) => {
      identifier(value, 'Skill ID')
      return state.skills.find((item) => item.id === value)
    }),
    getDependencies: () => request('getDependencies', undefined, () => state.dependencies),
    getLearningResources: (skillId) => request('getLearningResources', skillId, (id) => {
      skill(id)
      return state.learningResources.filter((item) => item.skillId === id)
    }),
    getPracticeTasks: (skillId) => request('getPracticeTasks', skillId, (id) => {
      skill(id)
      return state.practiceTasks.filter((item) => item.skillId === id)
    }),
    getSelectedCareers: () => request('getSelectedCareers', undefined, () =>
      state.selectedCareers.filter((item) => item.userId === userId)),
    setSelectedCareers: (careerIds) => request('setSelectedCareers', careerIds, (ids) => {
      if (!Array.isArray(ids) || new Set(ids).size !== ids.length) invalid('Career IDs must be a list without duplicates.')
      for (const id of ids) career(id)
      const selectedAt = timestamp()
      const selected = ids.map((careerId) =>
        state.selectedCareers.find((item) => item.userId === userId && item.careerId === careerId) ??
        { userId, careerId, selectedAt })
      state.selectedCareers = [...state.selectedCareers.filter((item) => item.userId !== userId), ...selected]
      return selected
    }),
    getProgress: () => request('getProgress', undefined, progressForUser),
    updateProgress: (input) => request('updateProgress', input, (value) => {
      fields(value, ['skillId', 'status'])
      skill(value.skillId)
      if (!['not_started', 'learning', 'completed'].includes(value.status)) invalid('Unknown skill status.')
      const previous = progressForSkill(value.skillId)
      if (previous.status === value.status) return previous
      const changedAt = timestamp()
      const record = { userId, skillId: value.skillId, status: value.status as SkillStatus, updatedAt: changedAt }
      state.progress = [...state.progress.filter((item) => !(item.userId === userId && item.skillId === value.skillId)), record]
      state.history.push({
        id: nextId('progress'), userId, skillId: value.skillId,
        fromStatus: previous.status, toStatus: record.status, changedAt,
      })
      return progressForSkill(value.skillId)
    }),
    getProgressHistory: () => request('getProgressHistory', undefined, historyForUser),
    getQuizForSkill: (skillId) => request('getQuizForSkill', skillId, (id) => {
      skill(id)
      return state.quizzes.find((quiz) => quiz.skillId === id)
    }),
    submitQuizAttempt: (input) => request('submitQuizAttempt', input, (value): QuizResult => {
      fields(value, ['quizId', 'responses'])
      identifier(value.quizId, 'Quiz ID')
      const quiz = state.quizzes.find((item) => item.id === value.quizId)
      if (!quiz) throw new ServiceError('NOT_FOUND', `Quiz not found: ${value.quizId}`)
      if (!Array.isArray(value.responses) || value.responses.length !== quiz.questions.length) {
        invalid('Submit exactly one response for every quiz question.')
      }
      const seen = new Set<string>()
      for (const response of value.responses) {
        fields(response, ['questionId', 'optionId'])
        identifier(response.questionId, 'Question ID')
        identifier(response.optionId, 'Option ID')
        if (seen.has(response.questionId)) invalid('Duplicate question response.')
        seen.add(response.questionId)
        const question = quiz.questions.find((item) => item.id === response.questionId)
        if (!question || !question.options.some((option) => option.id === response.optionId)) {
          invalid('Response must reference a question and option from this quiz.')
        }
      }
      const feedback = quiz.questions.map((question) => {
        const response = value.responses.find((item) => item.questionId === question.id)!
        const key = state.answerKeys[question.id]
        return {
          questionId: question.id, selectedOptionId: response.optionId,
          correctOptionId: key.correctOptionId, correct: response.optionId === key.correctOptionId,
          explanation: key.explanation,
        }
      })
      const correctCount = feedback.filter((item) => item.correct).length
      const submittedAt = timestamp()
      const attempt = {
        id: nextId('attempt'), userId, quizId: quiz.id, skillId: quiz.skillId,
        responses: value.responses, correctCount, totalQuestions: quiz.questions.length,
        score: Math.round(correctCount / quiz.questions.length * 100),
        passed: correctCount / quiz.questions.length >= quiz.passThreshold / 100,
        submittedAt,
      }
      state.attempts.push(attempt)
      return { attempt, feedback }
    }),
    getQuizAttempts: (quizId) => request('getQuizAttempts', quizId, (id) => {
      if (id !== undefined) {
        identifier(id, 'Quiz ID')
        if (!state.quizzes.some((quiz) => quiz.id === id)) throw new ServiceError('NOT_FOUND', `Quiz not found: ${id}`)
      }
      return attemptsForUser().filter((attempt) => id === undefined || attempt.quizId === id)
    }),
    getAnalytics: () => request('getAnalytics', undefined, (): Analytics => {
      const progress = progressForUser()
      const attempts = attemptsForUser()
      return {
        userId, totalSkills: state.skills.length,
        completedSkills: progress.filter((item) => item.status === 'completed').length,
        learningSkills: progress.filter((item) => item.status === 'learning').length,
        verifiedSkills: progress.filter((item) => item.verified).length,
        careers: state.careerPaths.map((item) => {
          const subset = progress.filter((record) => item.skillIds.includes(record.skillId))
          const completedSkills = subset.filter((record) => record.status === 'completed').length
          return {
            careerId: item.id, totalSkills: subset.length, completedSkills,
            verifiedSkills: subset.filter((record) => record.verified).length,
            completionPercent: subset.length ? Math.round(completedSkills / subset.length * 100) : 0,
          }
        }),
        quizzes: {
          attemptCount: attempts.length, passedCount: attempts.filter((attempt) => attempt.passed).length,
          bestScore: attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null,
          averageScore: attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length) : null,
        },
        history: historyForUser(),
      }
    }),
    getRecommendations: (careerId) => request('getRecommendations', careerId, (id): Recommendation[] => {
      const path = career(id)
      const candidates = path.skillIds.map((skillId) => ({
        skill: skill(skillId), progress: progressForSkill(skillId),
        prerequisites: state.dependencies.filter((edge) => edge.skillId === skillId).map((edge) => edge.prerequisiteId),
      })).filter((item) => item.progress.status !== 'completed' && !item.progress.verified &&
        item.prerequisites.every((parent) => {
          const progress = progressForSkill(parent)
          return progress.status === 'completed' || progress.verified
        }))
      // Stable sort keeps authored career order for equal priorities.
      candidates.sort((a, b) => Number(b.progress.status === 'learning') - Number(a.progress.status === 'learning'))
      return candidates.map((item, index) => ({
        careerId: id, skillId: item.skill.id, rank: index + 1,
        priority: item.progress.status === 'learning' ? 'continue_learning' : 'start_next',
        prerequisiteIds: item.prerequisites,
        reason: `${item.progress.status === 'learning' ? 'Continue learning' : 'Start'} ${item.skill.name}; ${
          item.prerequisites.length
            ? `prerequisites completed or verified: ${item.prerequisites.map((parent) => skill(parent).name).join(', ')}`
            : 'no prerequisites'
        }.`,
      }))
    }),
  }
  if ([...failMethods].some((method) => !Object.hasOwn(service, method))) invalid('Unknown mock method in failMethods.')
  return service
}
