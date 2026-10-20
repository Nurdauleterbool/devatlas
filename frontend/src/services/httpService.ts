import type {
  Analytics, AuthSession, CareerPath, LearningResource, LoginInput, PracticeTask,
  ProgressEvent, Quiz, QuizAttempt, QuizResult, Recommendation, SignUpInput, Skill,
  SkillDependency, SubmitQuizInput, UpdateProgressInput, User, UserCareerPath, UserSkillProgress,
} from '../types/domain'
import type { DevAtlasService, ServiceErrorCode } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'

type Transport = typeof fetch
const allowedErrors = new Set<ServiceErrorCode>([
  'VALIDATION', 'NOT_FOUND', 'UNAVAILABLE', 'INVALID_CREDENTIALS',
  'EMAIL_IN_USE', 'UNAUTHENTICATED', 'FORBIDDEN', 'SESSION_CHANGED',
])

export interface HttpServiceOptions {
  baseUrl?: string
  fetcher?: Transport
}

/** Contract implementation; no local mock fixtures, passwords or owner IDs. */
export function createHttpService(options: HttpServiceOptions = {}): DevAtlasService {
  const base = (options.baseUrl ?? '/api/v1').replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch
  let sessionRevision = 0

  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const started = sessionRevision
    let response: Response
    try {
      response = await fetcher(`${base}${path}`, {
        method, credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      })
    } catch {
      if (started !== sessionRevision) throw new ServiceError('SESSION_CHANGED', 'Session changed during request.')
      throw new ServiceError('UNAVAILABLE', 'Cannot reach DevAtlas API. Check your connection and retry.')
    }
    if (started !== sessionRevision) throw new ServiceError('SESSION_CHANGED', 'Session changed during request.')
    if (!response.ok) {
      let error: { error?: { code?: string; message?: string } } = {}
      try { error = await response.json() as typeof error } catch { /* non-JSON errors */ }
      const code = error.error?.code
      if (code && allowedErrors.has(code as ServiceErrorCode)) {
        throw new ServiceError(code as ServiceErrorCode, error.error?.message || 'Request failed.')
      }
      throw new ServiceError('UNAVAILABLE', 'DevAtlas API request failed. Try again.')
    }
    if (response.status === 204) return undefined as T
    try {
      const value = await response.json() as T
      if (started !== sessionRevision) throw new ServiceError('SESSION_CHANGED', 'Session changed during request.')
      return value
    } catch (reason) {
      if (reason instanceof ServiceError) throw reason
      throw new ServiceError('UNAVAILABLE', 'Invalid API response. Try again.')
    }
  }

  const key = (id: string) => encodeURIComponent(id)
  const auth = async <T>(path: string, body: unknown) => {
    const value = await request<T>(path, 'POST', body)
    sessionRevision++
    return value
  }
  const service: DevAtlasService = {
    getSession: () => request<AuthSession | null>('/auth/session'),
    signUp: (input: SignUpInput) => auth<AuthSession>('/auth/signup', input),
    logIn: (input: LoginInput) => auth<AuthSession>('/auth/login', input),
    logInDemo: () => Promise.reject(new ServiceError('UNAVAILABLE', 'Demo login is available only in mock mode.')),
    logOut: async () => { await request<void>('/auth/logout', 'POST'); sessionRevision++ },
    getCurrentUser: () => request<User>('/auth/me'),
    getCareerPaths: () => request<CareerPath[]>('/career-paths'),
    getCareerPath: async (id) => {
      try { return await request<CareerPath>(`/career-paths/${key(id)}`) }
      catch (error) { if (error instanceof ServiceError && error.code === 'NOT_FOUND') return undefined; throw error }
    },
    getSkills: () => request<Skill[]>('/skills'),
    getSkill: async (id) => {
      try { return await request<Skill>(`/skills/${key(id)}`) }
      catch (error) { if (error instanceof ServiceError && error.code === 'NOT_FOUND') return undefined; throw error }
    },
    getDependencies: () => request<SkillDependency[]>('/dependencies'),
    getLearningResources: (id) => request<LearningResource[]>(`/skills/${key(id)}/resources`),
    getPracticeTasks: (id) => request<PracticeTask[]>(`/skills/${key(id)}/practice-tasks`),
    getSelectedCareers: () => request<UserCareerPath[]>('/me/careers'),
    setSelectedCareers: (careerIds) => request<UserCareerPath[]>('/me/careers', 'PUT', { careerIds }),
    getProgress: () => request<UserSkillProgress[]>('/progress'),
    updateProgress: ({ skillId, status }: UpdateProgressInput) =>
      request<UserSkillProgress>(`/me/progress/${key(skillId)}`, 'PUT', { status }),
    getProgressHistory: () => request<ProgressEvent[]>('/me/progress/history'),
    getQuizForSkill: (id) => request<Quiz | undefined>(`/skills/${key(id)}/quiz`),
    submitQuizAttempt: ({ quizId, responses }: SubmitQuizInput) =>
      request<QuizResult>(`/quizzes/${key(quizId)}/attempts`, 'POST', { responses }),
    getQuizAttempts: (id) =>
      request<QuizAttempt[]>(`/me/quiz-attempts${id === undefined ? '' : `?quizId=${key(id)}`}`),
    getAnalytics: () => request<Analytics>('/me/analytics'),
    getRecommendations: (id) => request<Recommendation[]>(`/career-paths/${key(id)}/recommendations`),
  }
  return service
}
