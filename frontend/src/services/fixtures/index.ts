import type {
  ProgressEvent, QuizAttempt, SkillProgressRecord, UserCareerPath,
} from '../../types/domain'
import { answerKeys, quizzes } from './quizzes'
import { careerPaths, DEMO_USER_ID, dependencies, learningResources, practiceTasks, SEED_TIME, skills, users } from './catalog'

export interface MockFixtures {
  users: typeof users
  careerPaths: typeof careerPaths
  skills: typeof skills
  dependencies: typeof dependencies
  learningResources: typeof learningResources
  practiceTasks: typeof practiceTasks
  quizzes: typeof quizzes
  answerKeys: typeof answerKeys
  progress: SkillProgressRecord[]
  history: ProgressEvent[]
  attempts: QuizAttempt[]
  selectedCareers: UserCareerPath[]
}

const history: ProgressEvent[] = [
  { id: 'seed-html-learning', userId: DEMO_USER_ID, skillId: 'html', fromStatus: 'not_started', toStatus: 'learning', changedAt: '2026-10-02T12:00:00.000Z' },
  { id: 'seed-html-completed', userId: DEMO_USER_ID, skillId: 'html', fromStatus: 'learning', toStatus: 'completed', changedAt: '2026-10-03T12:00:00.000Z' },
  { id: 'seed-css-learning', userId: DEMO_USER_ID, skillId: 'css', fromStatus: 'not_started', toStatus: 'learning', changedAt: '2026-10-04T12:00:00.000Z' },
  { id: 'seed-python-learning', userId: DEMO_USER_ID, skillId: 'python', fromStatus: 'not_started', toStatus: 'learning', changedAt: '2026-10-05T12:00:00.000Z' },
  { id: 'seed-second-sql-learning', userId: 'second-student', skillId: 'sql', fromStatus: 'not_started', toStatus: 'learning', changedAt: '2026-10-06T12:00:00.000Z' },
]

const progress: SkillProgressRecord[] = history
  .filter((event, index) => !history.slice(index + 1).some((later) => later.userId === event.userId && later.skillId === event.skillId))
  .map((event) => ({ userId: event.userId, skillId: event.skillId, status: event.toStatus, updatedAt: event.changedAt }))

function seedAttempt(skillId: string, userId: string, correctCount: number): QuizAttempt {
  const quiz = quizzes.find((item) => item.skillId === skillId)!
  return {
    id: `seed-${userId}-${skillId}-attempt`, userId, quizId: quiz.id, skillId,
    correctCount, totalQuestions: quiz.questions.length,
    score: correctCount / quiz.questions.length * 100,
    passed: correctCount / quiz.questions.length >= quiz.passThreshold / 100,
    submittedAt: '2026-10-07T12:00:00.000Z',
    responses: quiz.questions.map((question, index) => ({
      questionId: question.id,
      optionId: index < correctCount
        ? answerKeys[question.id].correctOptionId
        : question.options.find((option) => option.id !== answerKeys[question.id].correctOptionId)!.id,
    })),
  }
}

export const seedFixtures: MockFixtures = {
  users, careerPaths, skills, dependencies, learningResources, practiceTasks,
  quizzes, answerKeys, progress, history,
  attempts: [seedAttempt('html', DEMO_USER_ID, 3), seedAttempt('sql', 'second-student', 4)],
  selectedCareers: [{ userId: DEMO_USER_ID, careerId: 'frontend', selectedAt: SEED_TIME }],
}
