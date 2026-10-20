import type {
  Analytics, AuthSession, CareerPath, LearningResource, LoginInput, PracticeTask, ProgressEvent,
  Quiz, QuizAttempt, QuizResult, Recommendation, Skill, SkillDependency,
  SignUpInput, SubmitQuizInput, UpdateProgressInput, User, UserCareerPath, UserSkillProgress,
} from '../types/domain'

/** Session-scoped contract: implementations derive ownership, never accept a user ID from a page. */
export interface DevAtlasService {
  getSession(): Promise<AuthSession | null>
  signUp(input: SignUpInput): Promise<AuthSession>
  logIn(input: LoginInput): Promise<AuthSession>
  logInDemo(): Promise<AuthSession>
  logOut(): Promise<void>
  getCurrentUser(): Promise<User>
  getCareerPaths(): Promise<CareerPath[]>
  getCareerPath(id: string): Promise<CareerPath | undefined>
  getSkills(): Promise<Skill[]>
  getSkill(id: string): Promise<Skill | undefined>
  getDependencies(): Promise<SkillDependency[]>
  getLearningResources(skillId: string): Promise<LearningResource[]>
  getPracticeTasks(skillId: string): Promise<PracticeTask[]>
  getSelectedCareers(): Promise<UserCareerPath[]>
  setSelectedCareers(careerIds: string[]): Promise<UserCareerPath[]>
  getProgress(): Promise<UserSkillProgress[]>
  updateProgress(input: UpdateProgressInput): Promise<UserSkillProgress>
  getProgressHistory(): Promise<ProgressEvent[]>
  getQuizForSkill(skillId: string): Promise<Quiz | undefined>
  submitQuizAttempt(input: SubmitQuizInput): Promise<QuizResult>
  getQuizAttempts(quizId?: string): Promise<QuizAttempt[]>
  getAnalytics(): Promise<Analytics>
  getRecommendations(careerId: string): Promise<Recommendation[]>
}

export type ServiceErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'UNAVAILABLE' |
  'INVALID_CREDENTIALS' | 'EMAIL_IN_USE' | 'UNAUTHENTICATED' | 'SESSION_CHANGED'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode

  constructor(code: ServiceErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}
