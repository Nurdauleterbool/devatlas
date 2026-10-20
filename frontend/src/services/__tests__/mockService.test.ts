import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SubmitQuizInput, UpdateProgressInput } from '../../types/domain'
import type { DevAtlasService } from '../DevAtlasService'
import { ServiceError } from '../DevAtlasService'
import { createMockService } from '../mockService'
import type { MockServiceOptions } from '../mockService'
import { seedFixtures } from '../fixtures'

const NOW = '2026-10-20T12:00:00.000Z'
const makeService = (options: MockServiceOptions = {}): DevAtlasService =>
  createMockService({ now: () => new Date(NOW), ...options })

function answers(skillId: string, correctCount: number): SubmitQuizInput {
  const quiz = seedFixtures.quizzes.find((item) => item.skillId === skillId)!
  return {
    quizId: quiz.id,
    responses: quiz.questions.map((question, index) => ({
      questionId: question.id,
      optionId: index < correctCount
        ? seedFixtures.answerKeys[question.id].correctOptionId
        : question.options.find((option) => option.id !== seedFixtures.answerKeys[question.id].correctOptionId)!.id,
    })),
  }
}

afterEach(() => vi.useRealTimers())

describe('session-scoped read contract', () => {
  it('returns catalogue definitions, user data, resources and practice through asynchronous methods', async () => {
    const service: DevAtlasService = makeService()
    const pending = service.getCareerPaths()
    expect(pending).toBeInstanceOf(Promise)
    const paths = await pending
    expect(paths.map((path) => path.id)).toEqual(['frontend', 'backend', 'analyst'])
    expect(await service.getCareerPath('frontend')).toEqual(paths[0])
    expect(await service.getCareerPath('missing')).toBeUndefined()
    expect(await service.getCurrentUser()).toMatchObject({ id: 'demo-student', email: 'student@example.test' })
    expect(await service.getSkill('html')).toMatchObject({ name: 'HTML' })
    expect(await service.getSkill('missing')).toBeUndefined()
    expect(await service.getSkills()).toHaveLength(10)
    expect(await service.getDependencies()).toContainEqual({ skillId: 'react', prerequisiteId: 'javascript' })
    expect(await service.getLearningResources('html')).toEqual([expect.objectContaining({ skillId: 'html', isFree: true })])
    expect(await service.getPracticeTasks('html')).toEqual([expect.objectContaining({ skillId: 'html' })])
    await expect(service.getLearningResources('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.getCareerPath('')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('keeps self-assessment, verification, shared definitions and other users separate', async () => {
    const service = makeService()
    const progress = await service.getProgress()
    expect(progress).toHaveLength(10)
    expect(progress.find((item) => item.skillId === 'html')).toMatchObject({ status: 'completed', verified: false, bestQuizScore: 60 })
    expect(progress.find((item) => item.skillId === 'python')).toMatchObject({ status: 'learning', bestQuizScore: null })
    expect(progress.find((item) => item.skillId === 'sql')).toMatchObject({ status: 'not_started', verified: false, bestQuizScore: null })
    expect(progress.every((item) => item.userId === 'demo-student')).toBe(true)
    expect(await service.getProgressHistory()).toHaveLength(4)
    expect((await service.getQuizAttempts()).map((attempt) => attempt.score)).toEqual([60])
    expect(await service.getSelectedCareers()).toEqual([expect.objectContaining({ careerId: 'frontend', userId: 'demo-student' })])
    expect(await service.getSkill('python')).not.toHaveProperty('status')
  })

  it('binds reads and writes to the selected mock session', async () => {
    const second = makeService({ userId: 'second-student' })
    expect(await second.getCurrentUser()).toMatchObject({ id: 'second-student' })
    expect((await second.getProgress()).find((item) => item.skillId === 'sql')).toMatchObject({ verified: true, bestQuizScore: 80 })
    expect((await second.getProgress()).find((item) => item.skillId === 'html')).toMatchObject({ status: 'not_started', bestQuizScore: null })
    expect((await second.getQuizAttempts()).every((attempt) => attempt.userId === 'second-student')).toBe(true)
    expect((await second.getProgressHistory()).every((event) => event.userId === 'second-student')).toBe(true)
    expect(await second.getSelectedCareers()).toEqual([])
    expect(await second.updateProgress({ skillId: 'sql', status: 'completed' })).toMatchObject({ userId: 'second-student' })
    expect((await makeService().getProgress()).find((item) => item.skillId === 'sql')?.status).toBe('not_started')
  })

  it('returns defensive copies and creates independent stores without modifying seed fixtures', async () => {
    const original = structuredClone(seedFixtures)
    const service = makeService()
    const paths = await service.getCareerPaths()
    paths[0].skillIds.length = 0
    const user = await service.getCurrentUser()
    user.displayName = 'Changed'
    const quiz = (await service.getQuizForSkill('html'))!
    quiz.questions[0].options[0].text = 'Changed'
    const progress = await service.getProgress()
    progress[0].verified = true
    await service.updateProgress({ skillId: 'css', status: 'completed' })
    expect((await service.getCareerPath('frontend'))?.skillIds).toHaveLength(4)
    expect((await service.getCurrentUser()).displayName).toBe('Demo Student')
    expect((await service.getQuizForSkill('html'))?.questions[0].options[0].text).not.toBe('Changed')
    expect((await service.getProgress())[0].verified).toBe(false)
    expect((await makeService().getProgress()).find((item) => item.skillId === 'css')?.status).toBe('learning')
    expect(seedFixtures).toEqual(original)
  })

  it('copies supplied fixtures and rejects an unknown session', async () => {
    const fixtures = structuredClone(seedFixtures)
    const service = makeService({ fixtures })
    fixtures.skills[0].name = 'Changed externally'
    expect((await service.getSkill('html'))?.name).toBe('HTML')
    expect(() => makeService({ userId: 'missing' })).toThrow('Mock session user was not found.')
  })
})

describe('progress and career mutations', () => {
  it('records reversible status changes with timestamps and keeps no-op updates idempotent', async () => {
    const service = makeService()
    const originalHistory = await service.getProgressHistory()
    await service.updateProgress({ skillId: 'html', status: 'completed' })
    expect(await service.getProgressHistory()).toEqual(originalHistory)
    for (const status of ['learning', 'completed', 'not_started'] as const) {
      expect(await service.updateProgress({ skillId: 'sql', status })).toMatchObject({ skillId: 'sql', status, updatedAt: NOW, verified: false })
    }
    const events = (await service.getProgressHistory()).slice(-3)
    expect(events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
      ['not_started', 'learning'], ['learning', 'completed'], ['completed', 'not_started'],
    ])
    expect(new Set(events.map((event) => event.id)).size).toBe(3)
    expect(events.every((event) => event.userId === 'demo-student' && event.changedAt === NOW)).toBe(true)
  })

  const invalidProgress: [string, unknown, string][] = [
    ['null payload', null, 'VALIDATION'],
    ['invalid status', { skillId: 'css', status: 'verified' }, 'VALIDATION'],
    ['unknown skill', { skillId: 'missing', status: 'learning' }, 'NOT_FOUND'],
    ['empty skill', { skillId: '', status: 'learning' }, 'VALIDATION'],
    ['forged owner', { skillId: 'css', status: 'completed', userId: 'second-student' }, 'VALIDATION'],
    ['forged verification', { skillId: 'css', status: 'completed', verified: true }, 'VALIDATION'],
    ['uncloneable data', { skillId: 'css', status: 'completed', callback: () => {} }, 'VALIDATION'],
  ]
  it.each(invalidProgress)('rejects %s without altering progress/history', async (_label, input, code) => {
    const service = makeService()
    const before = await service.getProgress()
    const history = await service.getProgressHistory()
    const pending = service.updateProgress(input as UpdateProgressInput)
    expect(pending).toBeInstanceOf(Promise)
    await expect(pending).rejects.toMatchObject({ code })
    expect(await service.getProgress()).toEqual(before)
    expect(await service.getProgressHistory()).toEqual(history)
  })

  it('replaces and clears career selections, validates atomically, and preserves existing timestamps', async () => {
    const service = makeService()
    const initial = await service.getSelectedCareers()
    const selected = await service.setSelectedCareers(['frontend', 'backend'])
    expect(selected[0]).toEqual(initial[0])
    expect(selected[1]).toMatchObject({ careerId: 'backend', selectedAt: NOW, userId: 'demo-student' })
    await expect(service.setSelectedCareers(['analyst', 'missing'])).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.setSelectedCareers(['backend', 'backend'])).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.setSelectedCareers(new Array<string>(1))).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await service.getSelectedCareers()).toEqual(selected)
    expect(await service.setSelectedCareers([])).toEqual([])
    expect(await service.getSelectedCareers()).toEqual([])
  })

  it('snapshots mutation inputs before latency and rejects an invalid clock without writing', async () => {
    vi.useFakeTimers()
    const service = makeService({ latencyMs: 100 })
    const input: UpdateProgressInput = { skillId: 'css', status: 'completed' }
    const pending = service.updateProgress(input)
    input.status = 'not_started'
    await vi.advanceTimersByTimeAsync(100)
    expect(await pending).toMatchObject({ status: 'completed' })
    vi.useRealTimers()
    const brokenClock = makeService({ now: () => new Date('invalid') })
    await expect(brokenClock.updateProgress({ skillId: 'css', status: 'completed' })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await brokenClock.getProgress()).find((item) => item.skillId === 'css')?.status).toBe('learning')
  })
})

describe('quiz grading and attempts', () => {
  it('omits answer keys and explanations until a valid submission', async () => {
    const service = makeService()
    const quiz = (await service.getQuizForSkill('html'))!
    expect(quiz.questions).toHaveLength(5)
    expect(JSON.stringify(quiz)).not.toMatch(/correctOptionId|explanation|answerKeys/)
    const result = await service.submitQuizAttempt(answers('html', 4))
    expect(result.feedback).toHaveLength(5)
    expect(result.feedback.every((item) => item.explanation.length > 0 && item.correctOptionId.length > 0)).toBe(true)
    expect(result.feedback.filter((item) => item.correct)).toHaveLength(4)
    expect(JSON.stringify(await service.getQuizForSkill('html'))).not.toMatch(/correctOptionId|explanation/)
  })

  it.each([[0, 0, false], [3, 60, false], [4, 80, true], [5, 100, true]] as const)(
    'grades %i/5 as %i percent with passed=%s', async (count, score, passed) => {
      const service = makeService()
      const { attempt } = await service.submitQuizAttempt(answers('python', count))
      expect(attempt).toMatchObject({ correctCount: count, score, passed, totalQuestions: 5, userId: 'demo-student', submittedAt: NOW })
      expect((await service.getProgress()).find((item) => item.skillId === 'python')).toMatchObject({
        status: 'learning', verified: passed, bestQuizScore: score, updatedAt: NOW,
      })
    },
  )

  it('keeps all retakes and best score; verification stays independent of self-assessment', async () => {
    const service = makeService()
    for (const count of [4, 5, 1]) await service.submitQuizAttempt(answers('python', count))
    const attempts = await service.getQuizAttempts('quiz-python')
    expect(attempts.map((attempt) => attempt.score)).toEqual([80, 100, 20])
    expect(new Set(attempts.map((attempt) => attempt.id)).size).toBe(3)
    expect(await service.updateProgress({ skillId: 'python', status: 'not_started' })).toMatchObject({
      status: 'not_started', verified: true, bestQuizScore: 100,
    })
    expect(await service.updateProgress({ skillId: 'css', status: 'completed' })).toMatchObject({ verified: false, bestQuizScore: null })
    await expect(service.getQuizAttempts('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  const invalidSubmissions: [string, (input: SubmitQuizInput) => unknown, string][] = [
    ['null input', () => null, 'VALIDATION'],
    ['unknown quiz', (input) => ({ ...input, quizId: 'missing' }), 'NOT_FOUND'],
    ['incomplete answers', (input) => ({ ...input, responses: input.responses.slice(1) }), 'VALIDATION'],
    ['duplicate question', (input) => ({ ...input, responses: [input.responses[0], ...input.responses.slice(0, 4)] }), 'VALIDATION'],
    ['foreign question', (input) => { input.responses[0].questionId = 'python-q1'; return input }, 'VALIDATION'],
    ['option from another question', (input) => { input.responses[0].optionId = input.responses[1].optionId; return input }, 'VALIDATION'],
    ['forged score', (input) => ({ ...input, score: 100 }), 'VALIDATION'],
    ['null response', (input) => ({ ...input, responses: [null, ...input.responses.slice(1)] }), 'VALIDATION'],
  ]
  it.each(invalidSubmissions)('rejects %s without adding attempts or changing progress', async (_label, corrupt, code) => {
    const service = makeService()
    const progress = await service.getProgress()
    const attempts = await service.getQuizAttempts()
    await expect(service.submitQuizAttempt(corrupt(answers('html', 5)) as SubmitQuizInput)).rejects.toMatchObject({ code })
    expect(await service.getQuizAttempts()).toEqual(attempts)
    expect(await service.getProgress()).toEqual(progress)
  })

  it('copies pending quiz responses and returned feedback/history', async () => {
    vi.useFakeTimers()
    const service = makeService({ latencyMs: 50 })
    const input = answers('python', 5)
    const pending = service.submitQuizAttempt(input)
    input.responses[0].optionId = 'tampered'
    await vi.advanceTimersByTimeAsync(50)
    const result = await pending
    expect(result.attempt.score).toBe(100)
    result.attempt.responses.length = 0
    const history = service.getQuizAttempts('quiz-python')
    await vi.advanceTimersByTimeAsync(50)
    expect((await history)[0].responses).toHaveLength(5)
  })
})

describe('analytics and deterministic recommendations', () => {
  it('counts unique skills, current-user attempts and seeded history', async () => {
    const summary = await makeService().getAnalytics()
    expect(summary).toMatchObject({
      userId: 'demo-student', totalSkills: 10, completedSkills: 1, learningSkills: 2, verifiedSkills: 0,
      quizzes: { attemptCount: 1, passedCount: 0, bestScore: 60, averageScore: 60 },
    })
    expect(summary.careers.map((career) => career.completionPercent)).toEqual([25, 0, 0])
    expect(summary.history).toHaveLength(4)
    const second = await makeService({ userId: 'second-student' }).getAnalytics()
    expect(second.quizzes).toEqual({ attemptCount: 1, passedCount: 1, bestScore: 80, averageScore: 80 })
    expect(second.verifiedSkills).toBe(1)
  })

  it('updates both careers sharing a skill and computes aggregate quiz statistics from attempts', async () => {
    const service = makeService()
    await service.updateProgress({ skillId: 'sql', status: 'completed' })
    await service.submitQuizAttempt(answers('sql', 4))
    const summary = await service.getAnalytics()
    expect(summary.completedSkills).toBe(2)
    expect(summary.verifiedSkills).toBe(1)
    expect(summary.careers.map((career) => career.completionPercent)).toEqual([25, 25, 25])
    expect(summary.quizzes).toEqual({ attemptCount: 2, passedCount: 1, bestScore: 80, averageScore: 70 })
    expect(summary.history.at(-1)).toMatchObject({ skillId: 'sql', toStatus: 'completed' })
  })

  it('recommends eligible learning skills first, then authored order, with prerequisite explanations', async () => {
    const service = makeService()
    const first = await service.getRecommendations('frontend')
    expect(first.map((item) => item.skillId)).toEqual(['css', 'javascript'])
    expect(first.map((item) => item.rank)).toEqual([1, 2])
    expect(first[0]).toMatchObject({ priority: 'continue_learning', prerequisiteIds: ['html'] })
    expect(first[0].reason).toContain('HTML')
    expect(await service.getRecommendations('frontend')).toEqual(first)
    await service.updateProgress({ skillId: 'css', status: 'not_started' })
    await service.updateProgress({ skillId: 'javascript', status: 'learning' })
    expect((await service.getRecommendations('frontend')).map((item) => item.skillId)).toEqual(['javascript', 'css'])
    await service.updateProgress({ skillId: 'javascript', status: 'completed' })
    expect((await service.getRecommendations('frontend')).map((item) => item.skillId)).toEqual(['css', 'react'])
  })

  it('unlocks dependents of quiz-verified skills without marking self-assessment complete', async () => {
    const service = makeService()
    expect((await service.getRecommendations('backend')).map((item) => item.skillId)).not.toContain('fastapi')
    await service.submitQuizAttempt(answers('python', 4))
    expect((await service.getRecommendations('backend')).map((item) => item.skillId)).toEqual(['sql', 'fastapi'])
    expect((await service.getProgress()).find((item) => item.skillId === 'python')?.status).toBe('learning')
    for (const skillId of ['python', 'sql', 'fastapi', 'databases']) {
      await service.updateProgress({ skillId, status: 'completed' })
    }
    expect(await service.getRecommendations('backend')).toEqual([])
    await expect(service.getRecommendations('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('loading, empty and error scenarios', () => {
  it('waits for configured latency without changing the contract', async () => {
    vi.useFakeTimers()
    const service = makeService({ latencyMs: 100 })
    let settled = false
    const pending = service.getCareerPaths().then((paths) => { settled = true; return paths })
    await vi.advanceTimersByTimeAsync(99)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toHaveLength(3)
  })

  it('returns a coherent empty catalogue and zero analytics, while rejecting unknown writes', async () => {
    const service = makeService({ scenario: 'empty' })
    expect(await service.getCurrentUser()).toMatchObject({ id: 'demo-student' })
    for (const read of [service.getCareerPaths, service.getSkills, service.getDependencies, service.getProgress,
      service.getProgressHistory, service.getQuizAttempts, service.getSelectedCareers]) {
      expect(await read()).toEqual([])
    }
    expect(await service.getCareerPath('frontend')).toBeUndefined()
    expect(await service.getSkill('html')).toBeUndefined()
    expect(await service.getAnalytics()).toMatchObject({
      totalSkills: 0, completedSkills: 0, verifiedSkills: 0, careers: [], history: [],
      quizzes: { attemptCount: 0, passedCount: 0, bestScore: null, averageScore: null },
    })
    await expect(service.updateProgress({ skillId: 'html', status: 'completed' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.submitQuizAttempt(answers('html', 5))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('injects typed global failures after latency, or per-method failures without writing', async () => {
    vi.useFakeTimers()
    const failing = makeService({ scenario: 'error', latencyMs: 50 })
    const rejected = expect(failing.getCareerPaths()).rejects.toMatchObject({ name: 'ServiceError', code: 'UNAVAILABLE', message: 'Mock request failed: getCareerPaths' })
    await vi.advanceTimersByTimeAsync(50)
    await rejected
    vi.useRealTimers()
    const service = makeService({ failMethods: ['updateProgress'] })
    const before = await service.getProgress()
    await expect(service.updateProgress({ skillId: 'css', status: 'completed' })).rejects.toBeInstanceOf(ServiceError)
    expect(await service.getProgress()).toEqual(before)
  })

  it.each([-1, NaN, Infinity])('rejects invalid latency %s', (latencyMs) => {
    expect(() => makeService({ latencyMs })).toThrow('latencyMs must be a finite nonnegative number.')
  })
})
