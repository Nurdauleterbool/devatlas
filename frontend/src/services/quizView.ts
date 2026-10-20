import type { Quiz, QuizAttempt, Skill } from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'
import { publicQuiz } from './skillDetails'

export interface QuizView {
  skill: Skill
  quiz: Quiz | undefined
  attempts: QuizAttempt[]
  bestScore: number | null
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
function invalid(message: string): never {
  throw new ServiceError('VALIDATION', message)
}

/** Read public questions and session-owned attempts; grading remains entirely in the adapter. */
export async function getQuizView(service: DevAtlasService, skillId: string, signedIn: boolean): Promise<QuizView | undefined> {
  if (!nonempty(skillId)) invalid('Quiz skill ID must be a nonempty string.')
  const selected = await service.getSkill(skillId)
  if (selected === undefined) return undefined
  if (!selected || selected.id !== skillId || !nonempty(selected.name) || typeof selected.description !== 'string') {
    invalid('Quiz skill does not match the requested skill.')
  }
  const skill = { id: selected.id, name: selected.name, description: selected.description }
  const quiz = publicQuiz(await service.getQuizForSkill(skillId), skillId)
  if (!quiz) return { skill, quiz: undefined, attempts: [], bestScore: null }
  if (quiz.questions.length < 5 || quiz.questions.length > 10 || quiz.passThreshold !== 80
    || quiz.questions.some((question) => question.options.length !== 4)) {
    invalid('A practice quiz requires 5–10 questions, four choices per question and an 80% passing threshold.')
  }
  if (!signedIn) return { skill, quiz, attempts: [], bestScore: null }

  const [user, stored] = await Promise.all([service.getCurrentUser(), service.getQuizAttempts(quiz.id)])
  if (!user || !nonempty(user.id) || !Array.isArray(stored)) invalid('Quiz history is unavailable for the current user.')
  const questions = new Map(quiz.questions.map((question) => [question.id, question]))
  const seenIds = new Set<string>()
  const attempts = stored.map((attempt): QuizAttempt => {
    if (!attempt || !nonempty(attempt.id) || seenIds.has(attempt.id)
      || attempt.userId !== user.id || attempt.quizId !== quiz.id || attempt.skillId !== skillId) {
      invalid('Quiz history contains an invalid or foreign attempt.')
    }
    seenIds.add(attempt.id)
    if (attempt.totalQuestions !== quiz.questions.length || !Number.isInteger(attempt.correctCount)
      || attempt.correctCount < 0 || attempt.correctCount > attempt.totalQuestions
      || !Number.isFinite(attempt.score) || attempt.score < 0 || attempt.score > 100
      || attempt.score !== Math.round(attempt.correctCount / attempt.totalQuestions * 100)
      || typeof attempt.passed !== 'boolean' || attempt.passed !== (attempt.correctCount / attempt.totalQuestions >= 0.8)
      || !nonempty(attempt.submittedAt) || !Number.isFinite(Date.parse(attempt.submittedAt))) {
      invalid('Quiz history contains malformed result metrics or a timestamp.')
    }
    if (!Array.isArray(attempt.responses) || attempt.responses.length !== quiz.questions.length) {
      invalid('Quiz history contains incomplete responses.')
    }
    const answered = new Set<string>()
    const responses = attempt.responses.map((response) => {
      const question = response && questions.get(response.questionId)
      if (!question || answered.has(question.id) || !question.options.some((option) => option.id === response.optionId)) {
        invalid('Quiz history contains an invalid response reference.')
      }
      answered.add(question.id)
      return { questionId: response.questionId, optionId: response.optionId }
    })
    // Whitelist the public attempt contract instead of exposing adapter-only fields.
    return {
      id: attempt.id, userId: attempt.userId, quizId: attempt.quizId, skillId: attempt.skillId,
      correctCount: attempt.correctCount, totalQuestions: attempt.totalQuestions,
      score: attempt.score, passed: attempt.passed, submittedAt: attempt.submittedAt, responses,
    }
  }).sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt) || a.id.localeCompare(b.id))
  return { skill, quiz, attempts, bestScore: attempts.length ? Math.max(...attempts.map((attempt) => attempt.score)) : null }
}
