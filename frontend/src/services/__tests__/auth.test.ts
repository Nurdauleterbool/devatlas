import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockService } from '../mockService'
import { MAX_PASSWORD_LENGTH, normalizeEmail, validateAuth } from '../authValidation'
import { hashMockPassword, matchesMockPassword } from '../mockPasswords'
import { seedFixtures } from '../fixtures'

const alice = { displayName: 'Alice', email: 'alice@example.test', password: 'ExampleTest123!' }
const bob = { displayName: 'Bob', email: 'bob@example.test', password: 'AnotherTest123!' }
const clock = () => new Date('2026-10-20T12:00:00.000Z')
const makeService = () => createMockService({ initialSession: 'anonymous', now: clock })
afterEach(() => vi.useRealTimers())

describe('shared authentication validation', () => {
  it('requires email/password and a signup name', () => {
    expect(validateAuth({}, 'login')).toEqual({ email: 'Enter your email address.', password: 'Enter your password.' })
    expect(validateAuth(null, 'signup')).toHaveProperty('displayName')
    expect(validateAuth(alice, 'signup')).toEqual({})
    expect(normalizeEmail(' ALICE@Example.Test ')).toBe('alice@example.test')
  })
  it.each(['missing-at', 'a@', '@example.test', 'a@localhost', 'a@@example.test', 'a@example..test', 'a b@example.test', '<a>@example.test', '.a@example.test', 'a.@example.test', 'a..b@example.test', 'a@-example.test', 'a@example-.test'])(
    'rejects invalid email %s', (email) => {
      expect(validateAuth({ ...alice, email }, 'login')).toHaveProperty('email')
    },
  )
  it.each(['short', '       ', 'x'.repeat(MAX_PASSWORD_LENGTH + 1)])('rejects invalid password length/content', (password) => {
    expect(validateAuth({ ...alice, password }, 'signup')).toHaveProperty('password')
  })
  it('accepts boundary lengths and validates the trimmed display name', () => {
    expect(validateAuth({ ...alice, password: 'x'.repeat(8) }, 'signup')).toEqual({})
    expect(validateAuth({ ...alice, password: 'x'.repeat(128) }, 'signup')).toEqual({})
    expect(validateAuth({ ...alice, displayName: ' ' }, 'signup')).toHaveProperty('displayName')
    expect(validateAuth({ ...alice, displayName: 'x'.repeat(81) }, 'signup')).toHaveProperty('displayName')
  })
})

describe('mock accounts and sessions', () => {
  it('starts anonymously when configured and keeps Issue #2 default demo behavior', async () => {
    const service = makeService()
    expect(await service.getSession()).toBeNull()
    await expect(service.getCurrentUser()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(await service.getCareerPaths()).toHaveLength(3)
    expect((await service.getProgress()).find((item) => item.skillId === 'html')?.status).toBe('completed')
    expect(await createMockService().getCurrentUser()).toMatchObject({ id: 'demo-student' })
  })
  it('registers a normalized account, returns no credential data and gives it fresh progress', async () => {
    const service = makeService()
    const session = await service.signUp({ ...alice, email: ' ALICE@Example.Test ', displayName: ' Alice ' })
    expect(session).toMatchObject({ kind: 'mock', authenticatedAt: clock().toISOString(), user: { displayName: 'Alice', email: alice.email } })
    expect(JSON.stringify(session)).not.toMatch(/password|salt|digest|ExampleTest123/)
    expect(await service.getCurrentUser()).toEqual(session.user)
    expect((await service.getProgress()).every((item) => item.userId === session.user.id && item.status === 'not_started')).toBe(true)
    expect(await service.getQuizAttempts()).toEqual([])
    expect(await service.getSelectedCareers()).toEqual([])
    session.user.displayName = 'Changed externally'
    expect((await service.getSession())?.user.displayName).toBe('Alice')
  })
  it('logs out, validates credentials and restores the same account', async () => {
    const service = makeService()
    const registered = await service.signUp(alice)
    await service.logOut()
    expect(await service.getSession()).toBeNull()
    await expect(service.logIn({ email: alice.email, password: 'WrongTest123!' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' })
    await expect(service.logIn({ email: 'unknown@example.test', password: alice.password })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' })
    expect(await service.getSession()).toBeNull()
    expect((await service.logIn({ email: 'ALICE@EXAMPLE.TEST', password: alice.password })).user.id).toBe(registered.user.id)
    await service.logOut()
    await service.logOut()
    expect(await service.getSession()).toBeNull()
  })
  it('rejects duplicate emails and malformed credentials without changing the session', async () => {
    const service = makeService()
    const original = await service.signUp(alice)
    await expect(service.signUp({ ...alice, email: ' ALICE@EXAMPLE.TEST ' })).rejects.toMatchObject({ code: 'EMAIL_IN_USE' })
    await expect(service.signUp({ ...bob, password: 'short' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.logIn({ email: 'invalid', password: alice.password })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await service.getSession()).toEqual(original)
  })
  it('preserves password whitespace and case instead of normalizing credentials', async () => {
    const service = makeService()
    const password = '  MixedCaseTest123!  '
    await service.signUp({ ...alice, password })
    await service.logOut()
    await expect(service.logIn({ email: alice.email, password: password.trim() })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(service.logIn({ email: alice.email, password: password.toLowerCase() })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect((await service.logIn({ email: alice.email, password })).user.email).toBe(alice.email)
  })
  it('isolates progress, selections, attempts and analytics while switching accounts', async () => {
    const service = makeService()
    const first = await service.signUp(alice)
    await service.updateProgress({ skillId: 'css', status: 'completed' })
    await service.setSelectedCareers(['frontend'])
    const quiz = (await service.getQuizForSkill('html'))!
    await service.submitQuizAttempt({ quizId: quiz.id, responses: quiz.questions.map((question) => ({ questionId: question.id, optionId: seedFixtures.answerKeys[question.id].correctOptionId })) })
    await service.logOut()
    const second = await service.signUp(bob)
    expect(second.user.id).not.toBe(first.user.id)
    expect((await service.getProgress()).every((item) => item.status === 'not_started' && !item.verified)).toBe(true)
    expect(await service.getQuizAttempts()).toEqual([])
    expect(await service.getProgressHistory()).toEqual([])
    expect(await service.getSelectedCareers()).toEqual([])
    expect((await service.getAnalytics()).completedSkills).toBe(0)
    await service.logOut()
    await expect(service.updateProgress({ skillId: 'css', status: 'learning' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await expect(service.getQuizAttempts()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await service.logIn({ email: alice.email, password: alice.password })
    expect((await service.getProgress()).find((item) => item.skillId === 'css')?.status).toBe('completed')
    expect(await service.getQuizAttempts()).toHaveLength(1)
    expect(await service.getSelectedCareers()).toHaveLength(1)
    expect((await service.getAnalytics()).verifiedSkills).toBe(1)
  })
  it('offers an explicit mock demo session and resets accounts with a new instance', async () => {
    const service = makeService()
    expect((await service.logInDemo()).user).toMatchObject({ id: 'demo-student', displayName: 'Demo Student' })
    await service.logOut()
    await service.signUp(alice)
    await expect(makeService().logIn({ email: alice.email, password: alice.password })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })
  it('hashes credentials with native crypto and verifies matching input', async () => {
    const record = await hashMockPassword(alice.password)
    expect(record.digest).toHaveLength(32)
    expect(record.salt).toHaveLength(16)
    expect(await matchesMockPassword(alice.password, record)).toBe(true)
    expect(await matchesMockPassword(bob.password, record)).toBe(false)
  })
  it('keeps failed authentication operations atomic', async () => {
    const service = createMockService({ initialSession: 'anonymous', failMethods: ['signUp', 'logIn', 'logOut'] })
    await expect(service.signUp(alice)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(await service.getSession()).toBeNull()
    await service.logInDemo()
    await expect(service.logOut()).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect((await service.getSession())?.user.id).toBe('demo-student')
  })
  it('cancels pending sign-in when logout starts', async () => {
    vi.useFakeTimers()
    const service = createMockService({ initialSession: 'anonymous', latencyMs: 100 })
    const rejected = expect(service.logInDemo()).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    const logout = service.logOut()
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    await logout
    const session = service.getSession()
    await vi.advanceTimersByTimeAsync(100)
    expect(await session).toBeNull()
  })
  it('does not apply a pending personal mutation after a session transition', async () => {
    vi.useFakeTimers()
    const service = createMockService({ latencyMs: 100 })
    const rejected = expect(service.updateProgress({ skillId: 'css', status: 'completed' })).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    const logout = service.logOut()
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    await logout
    const login = service.logInDemo()
    await vi.advanceTimersByTimeAsync(100)
    await login
    const progress = service.getProgress()
    await vi.advanceTimersByTimeAsync(100)
    expect((await progress).find((item) => item.skillId === 'css')?.status).toBe('learning')
  })
  it('serializes competing signups without creating two sessions', async () => {
    const service = makeService()
    const results = await Promise.allSettled([service.signUp(alice), service.signUp(alice)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await service.getSession())?.user.email).toBe(alice.email)
  })
})
