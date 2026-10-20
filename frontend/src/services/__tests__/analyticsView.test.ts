import { describe, expect, it, vi } from 'vitest'
import type { Analytics, Quiz, UserSkillProgress } from '../../types/domain'
import { createMockService } from '../mockService'
import { seedFixtures } from '../fixtures'
import { getAnalyticsView } from '../analyticsView'

function correctAnswers(quiz: Quiz) {
  return quiz.questions.map((question) => ({ questionId: question.id, optionId: seedFixtures.answerKeys[question.id].correctOptionId }))
}

describe('analytics history composition', () => {
  it('joins seeded history and current summary with four real dated completion points', async () => {
    const view = await getAnalyticsView(createMockService())
    expect(view.user.id).toBe('demo-student')
    expect(view.analytics).toMatchObject({ totalSkills: 10, completedSkills: 1, learningSkills: 2, verifiedSkills: 0 })
    expect(view.history).toHaveLength(4)
    expect(view.completionSeries.map((point) => point.completionPercent)).toEqual([0, 10, 10, 10])
    expect(view.completionSeries.map((point) => point.at)).toEqual(view.history.map((event) => event.changedAt))
    expect(view.history.map((event) => event.skillName)).toEqual(['HTML', 'HTML', 'CSS', 'Python'])
    expect(view.attempts).toHaveLength(1)
    expect(view.attempts[0]).toMatchObject({ skillName: 'HTML', score: 60, passed: false })
    expect(view.analytics.quizzes).toEqual({ attemptCount: 1, passedCount: 0, bestScore: 60, averageScore: 60 })
  })

  it('keeps a new user history empty without inventing a creation-date baseline', async () => {
    const service = createMockService({ initialSession: 'anonymous' })
    await service.signUp({ displayName: 'Analytics Student', email: 'analytics@example.test', password: 'AnalyticsTest123!' })
    const view = await getAnalyticsView(service)
    expect(view.history).toEqual([])
    expect(view.completionSeries).toEqual([])
    expect(view.attempts).toEqual([])
    expect(view.analytics).toMatchObject({ totalSkills: 10, completedSkills: 0, verifiedSkills: 0 })
    expect(view.analytics.quizzes).toMatchObject({ attemptCount: 0, bestScore: null, averageScore: null })
  })

  it('supports a coherent empty catalogue with finite zero summaries and no chart points', async () => {
    const view = await getAnalyticsView(createMockService({ scenario: 'empty' }))
    expect(view.careers).toEqual([])
    expect(view.completionSeries).toEqual([])
    expect(view.analytics.totalSkills).toBe(0)
    expect(view.analytics.completedSkills).toBe(0)
    expect(view.attempts).toEqual([])
  })

  it('decreases completion after a completed skill is reset to learning', async () => {
    const service = createMockService({ now: () => new Date('2026-10-20T12:00:00.000Z') })
    await service.updateProgress({ skillId: 'html', status: 'learning' })
    const view = await getAnalyticsView(service)
    expect(view.completionSeries.map((point) => point.completionPercent)).toEqual([0, 10, 10, 10, 0])
    expect(view.history.at(-1)).toMatchObject({ fromStatus: 'completed', toStatus: 'learning' })
    expect(view.analytics.completedSkills).toBe(0)
  })

  it('includes untouched existing completions when the retained history starts later', async () => {
    const service = createMockService()
    const analytics = await service.getAnalytics()
    vi.spyOn(service, 'getAnalytics').mockResolvedValue({ ...analytics, history: analytics.history.filter((event) => event.skillId !== 'html') })
    const view = await getAnalyticsView(service)
    expect(view.completionSeries.map((point) => point.completionPercent)).toEqual([10, 10])
    expect(view.completionSeries[0].at).toBe('2026-10-04T12:00:00.000Z')
    expect(view.analytics.completedSkills).toBe(1)
  })

  it('counts a shared skill once globally while retaining both career memberships', async () => {
    const service = createMockService()
    await service.updateProgress({ skillId: 'sql', status: 'completed' })
    const view = await getAnalyticsView(service)
    expect(view.analytics.totalSkills).toBe(10)
    expect(view.analytics.completedSkills).toBe(2)
    expect(view.completionSeries.at(-1)?.completionPercent).toBe(20)
    expect(view.analytics.careers.find((career) => career.careerId === 'backend')?.completionPercent).toBe(25)
    expect(view.analytics.careers.find((career) => career.careerId === 'analyst')?.completionPercent).toBe(25)
  })

  it('preserves same-time event order and collapses each instant to its final observed count', async () => {
    const service = createMockService({ now: () => new Date('2026-10-20T12:00:00.000Z') })
    await service.updateProgress({ skillId: 'css', status: 'completed' })
    await service.updateProgress({ skillId: 'css', status: 'learning' })
    const analytics = await service.getAnalytics()
    analytics.history.at(-2)!.id = 'z-first'
    analytics.history.at(-1)!.id = 'a-second'
    vi.spyOn(service, 'getAnalytics').mockResolvedValue(analytics)
    const view = await getAnalyticsView(service)
    expect(view.history.slice(-2).map((event) => event.id)).toEqual(['z-first', 'a-second'])
    expect(view.completionSeries).toHaveLength(5)
    expect(view.completionSeries.at(-1)).toEqual({ at: '2026-10-20T12:00:00.000Z', completedSkills: 1, completionPercent: 10, eventCount: 2 })
  })

  it('sorts out-of-order distinct timestamps before checking status chains', async () => {
    const service = createMockService()
    const analytics = await service.getAnalytics()
    vi.spyOn(service, 'getAnalytics').mockResolvedValue({ ...analytics, history: [...analytics.history].reverse() })
    const view = await getAnalyticsView(service)
    expect(view.history.map((event) => event.changedAt)).toEqual([...analytics.history].map((event) => event.changedAt))
    expect(view.completionSeries.at(-1)?.completedSkills).toBe(view.analytics.completedSkills)
  })

  it('keeps quiz verification independent from self-reported completion', async () => {
    const service = createMockService()
    const quiz = (await service.getQuizForSkill('sql'))!
    await service.submitQuizAttempt({ quizId: quiz.id, responses: correctAnswers(quiz) })
    const view = await getAnalyticsView(service)
    expect(view.analytics.completedSkills).toBe(1)
    expect(view.analytics.verifiedSkills).toBe(1)
    expect(view.completionSeries).toHaveLength(4)
    expect(view.analytics.quizzes).toEqual({ attemptCount: 2, passedCount: 1, bestScore: 100, averageScore: 80 })
  })

  it('isolates account history, quiz results and summary', async () => {
    const first = await getAnalyticsView(createMockService())
    const second = await getAnalyticsView(createMockService({ userId: 'second-student' }))
    expect(first.history.every((event) => event.userId === first.user.id)).toBe(true)
    expect(second.history).toHaveLength(1)
    expect(second.history[0]).toMatchObject({ skillName: 'SQL', toStatus: 'learning', userId: 'second-student' })
    expect(second.analytics).toMatchObject({ completedSkills: 0, learningSkills: 1, verifiedSkills: 1 })
    expect(second.analytics.quizzes.bestScore).toBe(80)
    expect(second.attempts.every((attempt) => attempt.userId === second.user.id)).toBe(true)
  })

  it('rejects foreign owners in any personal response', async () => {
    const foreignAnalytics = createMockService()
    vi.spyOn(foreignAnalytics, 'getAnalytics').mockResolvedValue({ ...await foreignAnalytics.getAnalytics(), userId: 'foreign' })
    await expect(getAnalyticsView(foreignAnalytics)).rejects.toMatchObject({ code: 'VALIDATION' })
    const foreignHistory = createMockService()
    const analytics = await foreignHistory.getAnalytics()
    analytics.history[0].userId = 'foreign'
    vi.spyOn(foreignHistory, 'getAnalytics').mockResolvedValue(analytics)
    await expect(getAnalyticsView(foreignHistory)).rejects.toMatchObject({ code: 'VALIDATION' })
    const foreignProgress = createMockService()
    const progress = await foreignProgress.getProgress()
    progress[0].userId = 'foreign'
    vi.spyOn(foreignProgress, 'getProgress').mockResolvedValue(progress)
    await expect(getAnalyticsView(foreignProgress)).rejects.toMatchObject({ code: 'VALIDATION' })
    const foreignAttempt = createMockService()
    const attempts = await foreignAttempt.getQuizAttempts()
    attempts[0].userId = 'foreign'
    vi.spyOn(foreignAttempt, 'getQuizAttempts').mockResolvedValue(attempts)
    await expect(getAnalyticsView(foreignAttempt)).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('rejects missing progress and unknown catalogue references', async () => {
    const missing = createMockService()
    vi.spyOn(missing, 'getProgress').mockResolvedValue([])
    await expect(getAnalyticsView(missing)).rejects.toThrow('missing current skill progress')
    const history = createMockService()
    const analytics = await history.getAnalytics()
    analytics.history[0].skillId = 'missing'
    vi.spyOn(history, 'getAnalytics').mockResolvedValue(analytics)
    await expect(getAnalyticsView(history)).rejects.toThrow('history event')
    const career = createMockService()
    const paths = await career.getCareerPaths()
    paths[0].skillIds.push('missing')
    vi.spyOn(career, 'getCareerPaths').mockResolvedValue(paths)
    await expect(getAnalyticsView(career)).rejects.toThrow('career reference')
  })

  it('rejects summaries that disagree with progress, career totals or quiz attempts', async () => {
    for (const patch of [
      (analytics: Analytics) => { analytics.completedSkills = 9 },
      (analytics: Analytics) => { analytics.totalSkills = 12 },
      (analytics: Analytics) => { analytics.careers[0].completionPercent = 99 },
      (analytics: Analytics) => { analytics.quizzes.attemptCount = 99 },
      (analytics: Analytics) => { analytics.quizzes.averageScore = 0 },
    ]) {
      const service = createMockService()
      const analytics = await service.getAnalytics()
      patch(analytics)
      vi.spyOn(service, 'getAnalytics').mockResolvedValue(analytics)
      await expect(getAnalyticsView(service)).rejects.toMatchObject({ code: 'VALIDATION' })
    }
  })

  it('rejects broken event chains, no-op events, duplicate IDs and invalid dates', async () => {
    for (const patch of [
      (analytics: Analytics) => { analytics.history[1].fromStatus = 'not_started' },
      (analytics: Analytics) => { analytics.history[0].toStatus = 'not_started' },
      (analytics: Analytics) => { analytics.history[1].id = analytics.history[0].id },
      (analytics: Analytics) => { analytics.history[0].changedAt = 'invalid date' },
    ]) {
      const service = createMockService()
      const analytics = await service.getAnalytics()
      patch(analytics)
      vi.spyOn(service, 'getAnalytics').mockResolvedValue(analytics)
      await expect(getAnalyticsView(service)).rejects.toMatchObject({ code: 'VALIDATION' })
    }
  })

  it('rejects malformed progress and retained quiz results', async () => {
    const progress = createMockService()
    const records = await progress.getProgress()
    records[0].status = 'invalid' as UserSkillProgress['status']
    vi.spyOn(progress, 'getProgress').mockResolvedValue(records)
    await expect(getAnalyticsView(progress)).rejects.toThrow('current progress')
    const attempts = createMockService()
    const history = await attempts.getQuizAttempts()
    history[0].score = 79
    vi.spyOn(attempts, 'getQuizAttempts').mockResolvedValue(history)
    await expect(getAnalyticsView(attempts)).rejects.toThrow('quiz attempt')
  })

  it('returns independent objects without mutating adapter arrays while sorting', async () => {
    const service = createMockService()
    const analytics = await service.getAnalytics()
    const paths = await service.getCareerPaths()
    const attempts = await service.getQuizAttempts()
    vi.spyOn(service, 'getAnalytics').mockResolvedValue(analytics)
    vi.spyOn(service, 'getCareerPaths').mockResolvedValue(paths)
    vi.spyOn(service, 'getQuizAttempts').mockResolvedValue(attempts)
    const before = structuredClone({ analytics, paths, attempts })
    const view = await getAnalyticsView(service)
    view.history[0].skillName = 'Changed'
    view.history[0].toStatus = 'completed'
    view.analytics.history[0].fromStatus = 'learning'
    view.careers[0].skillIds.push('changed')
    view.attempts[0].responses[0].optionId = 'changed'
    expect({ analytics, paths, attempts }).toEqual(before)
  })

  it('forwards all source read failures and never invents anonymous personal analytics', async () => {
    for (const method of ['getCurrentUser', 'getAnalytics', 'getSkills', 'getCareerPaths', 'getProgress', 'getQuizAttempts'] as const) {
      await expect(getAnalyticsView(createMockService({ failMethods: [method] }))).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    }
    await expect(getAnalyticsView(createMockService({ initialSession: 'anonymous' }))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})
