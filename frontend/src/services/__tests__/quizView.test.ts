import { describe, expect, it, vi } from 'vitest'
import type { Quiz, QuizAttempt } from '../../types/domain'
import { createMockService } from '../mockService'
import { seedFixtures } from '../fixtures'
import { getQuizView } from '../quizView'

function responses(quiz: Quiz, correctCount: number) {
  return quiz.questions.map((question, index) => ({
    questionId: question.id,
    optionId: index < correctCount ? seedFixtures.answerKeys[question.id].correctOptionId
      : question.options.find((option) => option.id !== seedFixtures.answerKeys[question.id].correctOptionId)!.id,
  }))
}
async function seedAttempt(): Promise<QuizAttempt> {
  const service = createMockService()
  const quiz = (await service.getQuizForSkill('html'))!
  return (await service.getQuizAttempts(quiz.id))[0]
}

describe('quiz view composition', () => {
  it('returns public questions without grading keys or anonymous private reads', async () => {
    const service = createMockService({ initialSession: 'anonymous' })
    const quiz = (await service.getQuizForSkill('html'))!
    vi.spyOn(service, 'getQuizForSkill').mockResolvedValue({
      ...quiz, questions: quiz.questions.map((question) => ({ ...question, correctOptionId: 'secret', explanation: 'Private' })),
      answerKeys: { private: true },
    } as Quiz)
    const attempts = vi.spyOn(service, 'getQuizAttempts')
    const user = vi.spyOn(service, 'getCurrentUser')
    const view = (await getQuizView(service, 'html', false))!
    expect(view.quiz).toEqual(quiz)
    expect(view.attempts).toEqual([])
    expect(view.bestScore).toBeNull()
    expect(JSON.stringify(view.quiz)).not.toMatch(/correctOptionId|answerKeys|explanation/)
    expect(attempts).not.toHaveBeenCalled()
    expect(user).not.toHaveBeenCalled()
  })

  it('accepts all ten seeded quizzes with five questions and four distinct options', async () => {
    const service = createMockService()
    for (const skill of await service.getSkills()) {
      const view = (await getQuizView(service, skill.id, false))!
      expect(view.skill).toEqual(skill)
      expect(view.quiz?.passThreshold).toBe(80)
      expect(view.quiz?.questions).toHaveLength(5)
      expect(view.quiz?.questions.every((question) => question.options.length === 4 && new Set(question.options.map((option) => option.id)).size === 4)).toBe(true)
    }
  })

  it('retains service-graded failures, exact 80% passes and best score after failed retakes', async () => {
    let time = Date.parse('2026-10-20T10:00:00.000Z')
    const service = createMockService({ now: () => new Date(time += 1000) })
    const quiz = (await service.getQuizForSkill('css'))!
    const failed = await service.submitQuizAttempt({ quizId: quiz.id, responses: responses(quiz, 3) })
    expect(failed.attempt).toMatchObject({ correctCount: 3, totalQuestions: 5, score: 60, passed: false })
    expect(failed.feedback.filter((item) => !item.correct)).toHaveLength(2)
    expect(failed.feedback.every((item) => item.explanation.length > 0)).toBe(true)
    expect((await getQuizView(service, 'css', true))?.bestScore).toBe(60)
    const passed = await service.submitQuizAttempt({ quizId: quiz.id, responses: responses(quiz, 4) })
    expect(passed.attempt).toMatchObject({ score: 80, passed: true })
    await service.submitQuizAttempt({ quizId: quiz.id, responses: responses(quiz, 0) })
    const final = (await getQuizView(service, 'css', true))!
    expect(final.attempts.map((attempt) => attempt.score)).toEqual([60, 80, 0])
    expect(final.bestScore).toBe(80)
    expect((await service.getProgress()).find((item) => item.skillId === 'css')?.verified).toBe(true)
    // With 5–10 questions, 79% is unrepresentable. Use the actual 3/5 vs 4/5 boundary.
  })

  it('reads history only for its current account and rejects a foreign adapter response', async () => {
    const first = createMockService()
    const second = createMockService({ userId: 'second-student' })
    expect((await getQuizView(first, 'sql', true))?.attempts).toEqual([])
    const secondView = (await getQuizView(second, 'sql', true))!
    expect(secondView.bestScore).toBe(80)
    expect(secondView.attempts[0].userId).toBe('second-student')
    vi.spyOn(first, 'getQuizAttempts').mockResolvedValue(secondView.attempts)
    await expect(getQuizView(first, 'sql', true)).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('handles missing skills, empty catalogue and known skills without a quiz', async () => {
    const service = createMockService()
    const privateRead = vi.spyOn(service, 'getQuizAttempts')
    expect(await getQuizView(service, 'missing', true)).toBeUndefined()
    expect(await getQuizView(createMockService({ scenario: 'empty' }), 'html', true)).toBeUndefined()
    vi.spyOn(service, 'getQuizForSkill').mockResolvedValue(undefined)
    expect(await getQuizView(service, 'html', true)).toMatchObject({ quiz: undefined, attempts: [], bestScore: null })
    expect(privateRead).not.toHaveBeenCalled()
  })

  it('keeps a quiz with no attempts distinct from a zero-scoring attempt', async () => {
    const service = createMockService()
    expect(await getQuizView(service, 'css', true)).toMatchObject({ attempts: [], bestScore: null })
    const quiz = (await service.getQuizForSkill('css'))!
    await service.submitQuizAttempt({ quizId: quiz.id, responses: responses(quiz, 0) })
    expect(await getQuizView(service, 'css', true)).toMatchObject({ bestScore: 0 })
  })

  it('rejects malformed skill IDs and mismatched skill lookups', async () => {
    const service = createMockService()
    const read = vi.spyOn(service, 'getSkill')
    await expect(getQuizView(service, '', false)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(read).not.toHaveBeenCalled()
    read.mockResolvedValue({ id: 'css', name: 'CSS', description: 'Mismatched' })
    await expect(getQuizView(service, 'html', false)).rejects.toThrow('requested skill')
  })

  it('validates question count, four choices and the 80% contract before exposing a quiz', async () => {
    const base = (await createMockService().getQuizForSkill('html'))!
    const invalid: Quiz[] = [
      { ...base, questions: base.questions.slice(0, 4) },
      { ...base, questions: Array.from({ length: 11 }, (_, index) => ({ ...base.questions[0], id: `question-${index}` })) },
      { ...base, questions: base.questions.map((question) => ({ ...question, options: question.options.slice(0, 3) })) },
      { ...base, passThreshold: 79 },
    ]
    for (const quiz of invalid) {
      const service = createMockService()
      vi.spyOn(service, 'getQuizForSkill').mockResolvedValue(quiz)
      await expect(getQuizView(service, 'html', false)).rejects.toMatchObject({ code: 'VALIDATION' })
    }
    const ten = createMockService()
    vi.spyOn(ten, 'getQuizForSkill').mockResolvedValue({
      ...base, questions: Array.from({ length: 10 }, (_, index) => ({ ...base.questions[0], id: `question-${index}` })),
    })
    expect((await getQuizView(ten, 'html', false))?.quiz?.questions).toHaveLength(10)
  })

  it('sorts attempts chronologically with deterministic ties and returns defensive public fields', async () => {
    const service = createMockService()
    const original = (await service.getQuizAttempts())[0]
    const a = { ...original, id: 'a', submittedAt: '2026-10-20T11:00:00.000Z' }
    const b = { ...original, id: 'b', submittedAt: '2026-10-20T11:00:00.000Z' }
    const earlier = { ...original, id: 'earlier', submittedAt: '2026-10-19T11:00:00.000Z' }
    const records = [b, { ...a, internal: 'private' }, earlier]
    vi.spyOn(service, 'getQuizAttempts').mockResolvedValue(records)
    const view = (await getQuizView(service, 'html', true))!
    expect(view.attempts.map((attempt) => attempt.id)).toEqual(['earlier', 'a', 'b'])
    expect(view.attempts[1]).not.toHaveProperty('internal')
    view.attempts[0].responses[0].optionId = 'Changed'
    expect(original.responses[0].optionId).not.toBe('Changed')
    expect(records.map((attempt) => attempt.id)).toEqual(['b', 'a', 'earlier'])
  })

  it('rejects attempts for another quiz or skill and duplicate attempt IDs', async () => {
    const original = await seedAttempt()
    for (const patch of [{ quizId: 'css-quiz' }, { skillId: 'css' }]) {
      const service = createMockService()
      vi.spyOn(service, 'getQuizAttempts').mockResolvedValue([{ ...original, ...patch }])
      await expect(getQuizView(service, 'html', true)).rejects.toThrow('invalid or foreign attempt')
    }
    const duplicate = createMockService()
    vi.spyOn(duplicate, 'getQuizAttempts').mockResolvedValue([original, original])
    await expect(getQuizView(duplicate, 'html', true)).rejects.toThrow('invalid or foreign attempt')
  })

  it('rejects impossible or inconsistent result metrics without grading any answers', async () => {
    const original = await seedAttempt()
    for (const patch of [
      { correctCount: -1 }, { correctCount: 6 }, { correctCount: 1.5 }, { totalQuestions: 0 },
      { score: Number.NaN }, { score: 101 }, { score: 79 }, { passed: true },
    ]) {
      const service = createMockService()
      vi.spyOn(service, 'getQuizAttempts').mockResolvedValue([{ ...original, ...patch }])
      await expect(getQuizView(service, 'html', true)).rejects.toThrow('malformed result metrics')
    }
  })

  it('rejects incomplete, duplicate and foreign response references', async () => {
    const original = await seedAttempt()
    const invalid = [
      original.responses.slice(1),
      original.responses.map(() => original.responses[0]),
      original.responses.map((response, index) => index === 0 ? { ...response, questionId: 'foreign' } : response),
      original.responses.map((response, index) => index === 0 ? { ...response, optionId: 'foreign' } : response),
    ]
    for (const responses of invalid) {
      const service = createMockService()
      vi.spyOn(service, 'getQuizAttempts').mockResolvedValue([{ ...original, responses }])
      await expect(getQuizView(service, 'html', true)).rejects.toMatchObject({ code: 'VALIDATION' })
    }
  })

  it('rejects malformed history collections, user metadata and timestamps', async () => {
    const history = createMockService()
    vi.spyOn(history, 'getQuizAttempts').mockResolvedValue(null as unknown as QuizAttempt[])
    await expect(getQuizView(history, 'html', true)).rejects.toThrow('current user')
    const user = createMockService()
    vi.spyOn(user, 'getCurrentUser').mockResolvedValue({ ...await user.getCurrentUser(), id: '' })
    await expect(getQuizView(user, 'html', true)).rejects.toThrow('current user')
    const timestamp = createMockService()
    vi.spyOn(timestamp, 'getQuizAttempts').mockResolvedValue([{ ...await seedAttempt(), submittedAt: 'not a timestamp' }])
    await expect(getQuizView(timestamp, 'html', true)).rejects.toThrow('timestamp')
  })

  it('forwards public and private adapter failures instead of showing invented history', async () => {
    for (const method of ['getSkill', 'getQuizForSkill', 'getCurrentUser', 'getQuizAttempts'] as const) {
      await expect(getQuizView(createMockService({ failMethods: [method] }), 'html', true)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    }
  })

  it('does not treat a stale signed-in UI flag as authentication', async () => {
    await expect(getQuizView(createMockService({ initialSession: 'anonymous' }), 'html', true)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})
