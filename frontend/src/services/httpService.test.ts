import { describe, expect, it, vi } from 'vitest'
import { createHttpService } from './httpService'
import { ServiceError } from './DevAtlasService'

function response(json: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(json), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('live HTTP service', () => {
  it('uses credentials and maps all read endpoints without mock data', async () => {
    const seen: { url: string; method: string; credentials: RequestCredentials | undefined }[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), method: init?.method ?? 'GET', credentials: init?.credentials })
      return response([])
    })
    const api = createHttpService({ fetcher: fetcher as typeof fetch })
    await api.getCareerPaths()
    await api.getSkills()
    await api.getDependencies()
    await api.getProgress()
    await api.getRecommendations('frontend')
    expect(seen.map((x) => x.url)).toEqual([
      '/api/v1/career-paths', '/api/v1/skills', '/api/v1/dependencies',
      '/api/v1/progress', '/api/v1/career-paths/frontend/recommendations',
    ])
    expect(seen.every((x) => x.credentials === 'include')).toBe(true)
  })

  it('keeps ownership and grading fields off mutation requests', async () => {
    const seen: { url: string; body: unknown; method: string }[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body && JSON.parse(String(init.body)), method: init?.method ?? 'GET' })
      return response({ userId: 'server-owner', status: 'learning' })
    })
    const api = createHttpService({ fetcher: fetcher as typeof fetch })
    await api.updateProgress({ skillId: 'html', status: 'learning' })
    await api.submitQuizAttempt({ quizId: 'quiz-html', responses: [{ questionId: 'q1', optionId: 'o1' }] })
    await api.setSelectedCareers(['frontend'])
    expect(seen).toEqual([
      { url: '/api/v1/me/progress/html', method: 'PUT', body: { status: 'learning' } },
      { url: '/api/v1/quizzes/quiz-html/attempts', method: 'POST',
        body: { responses: [{ questionId: 'q1', optionId: 'o1' }] } },
      { url: '/api/v1/me/careers', method: 'PUT', body: { careerIds: ['frontend'] } },
    ])
  })

  it('maps 404 optional lookups and 204 quiz absence', async () => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes('/quiz')
        ? response(null, 204)
        : response({ error: { code: 'NOT_FOUND', message: 'Missing' } }, 404))
    const api = createHttpService({ fetcher: fetcher as typeof fetch })
    expect(await api.getCareerPath('unknown')).toBeUndefined()
    expect(await api.getSkill('unknown')).toBeUndefined()
    expect(await api.getQuizForSkill('html')).toBeUndefined()
    await expect(api.getLearningResources('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('maps valid HTTP error codes and network failures', async () => {
    const api = createHttpService({ fetcher: vi.fn(async () =>
      response({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, 401)) as typeof fetch })
    await expect(api.getAnalytics()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    const offline = createHttpService({ fetcher: vi.fn(async () => { throw new Error('offline') }) as typeof fetch })
    await expect(offline.getCareerPaths()).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    const forbidden = createHttpService({ fetcher: vi.fn(async () =>
      response({ error: { code: 'FORBIDDEN', message: 'Bad origin' } }, 403)) as typeof fetch })
    await expect(forbidden.getSelectedCareers()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects stale responses after account changes', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('/skills')) {
        return new Promise<Response>((resolve) => { finish = resolve })
      }
      return response({ kind: 'http', user: { id: 'u1' }, authenticatedAt: '2026-10-20T00:00:00.000Z' })
    })
    const api = createHttpService({ fetcher: fetcher as typeof fetch })
    const pending = api.getSkills()
    await api.logIn({ email: 'user@example.test', password: 'password123' })
    finish(response([{ id: 'html' }]))
    await expect(pending).rejects.toBeInstanceOf(ServiceError)
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
  })

  it('keeps quiz posts single-attempt without implicit retry', async () => {
    const fetcher = vi.fn(async () => { throw new Error('connection dropped') })
    const api = createHttpService({ fetcher: fetcher as typeof fetch })
    await expect(api.submitQuizAttempt({ quizId: 'quiz-html', responses: [] }))
      .rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
