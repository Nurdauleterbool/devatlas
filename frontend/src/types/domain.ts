export type SkillStatus = 'not_started' | 'learning' | 'completed'

/** All timestamps crossing the service boundary are UTC ISO 8601 strings. */
export type Timestamp = string

export interface User {
  id: string
  displayName: string
  email: string
  createdAt: Timestamp
}

export interface CareerPath {
  id: string
  name: string
  description: string
  skillIds: string[]
}

/** Shared catalogue data; never contains a user's learning status. */
export interface Skill {
  id: string
  name: string
  description: string
}

export interface SkillDependency {
  skillId: string
  prerequisiteId: string
}

export interface UserCareerPath {
  userId: string
  careerId: string
  selectedAt: Timestamp
}

export interface SkillProgressRecord {
  userId: string
  skillId: string
  status: SkillStatus
  updatedAt: Timestamp
}

/** Verification and best score are derived from attempts, not editable status. */
export interface UserSkillProgress extends SkillProgressRecord {
  /** Passed a DevAtlas practice quiz; this is not a professional certification. */
  verified: boolean
  bestQuizScore: number | null
}

export interface UpdateProgressInput {
  skillId: string
  status: SkillStatus
}

export interface ProgressEvent {
  id: string
  userId: string
  skillId: string
  fromStatus: SkillStatus
  toStatus: SkillStatus
  changedAt: Timestamp
}

export interface LearningResource {
  id: string
  skillId: string
  title: string
  url: string
  kind: 'documentation' | 'course' | 'video'
  isFree: boolean
}

export interface PracticeTask {
  id: string
  skillId: string
  title: string
  description: string
}

export interface QuizOption {
  id: string
  text: string
}

/** Correct answers and explanations are deliberately absent before submission. */
export interface QuizQuestion {
  id: string
  prompt: string
  options: QuizOption[]
}

export interface Quiz {
  id: string
  skillId: string
  title: string
  passThreshold: number
  questions: QuizQuestion[]
}

export interface QuizResponse {
  questionId: string
  optionId: string
}

export interface SubmitQuizInput {
  quizId: string
  responses: QuizResponse[]
}

export interface QuizAttempt {
  id: string
  userId: string
  quizId: string
  skillId: string
  responses: QuizResponse[]
  correctCount: number
  totalQuestions: number
  score: number
  passed: boolean
  submittedAt: Timestamp
}

export interface QuizFeedback {
  questionId: string
  selectedOptionId: string
  correctOptionId: string
  correct: boolean
  explanation: string
}

export interface QuizResult {
  attempt: QuizAttempt
  feedback: QuizFeedback[]
}

export interface CareerProgress {
  careerId: string
  totalSkills: number
  completedSkills: number
  verifiedSkills: number
  completionPercent: number
}

export interface QuizStatistics {
  attemptCount: number
  passedCount: number
  bestScore: number | null
  averageScore: number | null
}

export interface Analytics {
  userId: string
  totalSkills: number
  completedSkills: number
  learningSkills: number
  verifiedSkills: number
  careers: CareerProgress[]
  quizzes: QuizStatistics
  history: ProgressEvent[]
}

export interface Recommendation {
  careerId: string
  skillId: string
  rank: number
  priority: 'continue_learning' | 'start_next'
  prerequisiteIds: string[]
  reason: string
}
