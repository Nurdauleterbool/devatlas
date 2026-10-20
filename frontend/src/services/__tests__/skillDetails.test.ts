import { describe, expect, it, vi } from 'vitest'
import type { LearningResource, Quiz, UserSkillProgress } from '../../types/domain'
import { createMockService } from '../mockService'
import { getSkillDetails, safeResourceUrl } from '../skillDetails'

describe('safe learning resource URLs', () => {
  it.each([
    ['https://example.com/learn', 'https://example.com/learn'],
    ['https://EXAMPLE.com', 'https://example.com/'],
    ['https://example.com:8443/path?q=one#topic', 'https://example.com:8443/path?q=one#topic'],
    ['https://[2001:db8::1]/learn', 'https://[2001:db8::1]/learn'],
    ['https://пример.рф/learn', 'https://xn--e1afmkfd.xn--p1ai/learn'],
  ])('accepts and canonicalizes %s', (value, expected) => {
    expect(safeResourceUrl(value)).toBe(expected)
  })
  it.each([
    '', '   ', 'not a URL', '/relative/path', '//example.com/path',
    'javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'mailto:student@example.com',
    'https://user:password@example.com/path', 'https://user@example.com', 'https://',
    'https://bad..example.com', 'https://-bad.example.com', 'https://bad_.example.com',
  ])('rejects unsafe or malformed %s', (value) => {
    expect(safeResourceUrl(value)).toBeNull()
  })
})

describe('adapter-independent skill details', () => {
  it('includes matching descriptions, prerequisites, free resources, practice and public quizzes for every seed skill', async () => {
    const service = createMockService()
    const skills = await service.getSkills()
    const dependencies = await service.getDependencies()
    expect(skills).toHaveLength(10)
    for (const skill of skills) {
      const details = (await getSkillDetails(service, skill.id))!
      expect(details.skill).toEqual(skill)
      expect(details.progress.skillId).toBe(skill.id)
      expect(details.prerequisites.map((item) => item.id)).toEqual(dependencies.filter((edge) => edge.skillId === skill.id).map((edge) => edge.prerequisiteId))
      expect(details.resources.length).toBeGreaterThan(0)
      expect(details.resources.every((resource) => resource.isFree && resource.skillId === skill.id && safeResourceUrl(resource.url))).toBe(true)
      expect(details.unavailableResourceCount).toBe(0)
      expect(details.practiceTasks.length).toBeGreaterThan(0)
      expect(details.quiz?.skillId).toBe(skill.id)
      expect(details.quiz?.questions).toHaveLength(5)
      expect(JSON.stringify(details.quiz)).not.toMatch(/correctOptionId|answerKeys|explanation/)
    }
  })

  it('shows current-user progress and refreshes updates without changing shared definitions', async () => {
    const service = createMockService()
    expect((await getSkillDetails(service, 'css'))?.progress.status).toBe('learning')
    await service.updateProgress({ skillId: 'css', status: 'completed' })
    expect((await getSkillDetails(service, 'css'))?.progress.status).toBe('completed')
    expect((await getSkillDetails(service, 'css'))?.skill).not.toHaveProperty('status')
  })

  it('keeps two accounts isolated and exposes public demo progress when anonymous', async () => {
    const first = createMockService()
    const second = createMockService({ userId: 'second-student' })
    const preview = createMockService({ initialSession: 'anonymous' })
    const firstSql = (await getSkillDetails(first, 'sql'))!
    const secondSql = (await getSkillDetails(second, 'sql'))!
    expect(firstSql.progress).toMatchObject({ userId: 'demo-student', status: 'not_started', verified: false, bestQuizScore: null })
    expect(secondSql.progress).toMatchObject({ userId: 'second-student', status: 'learning', verified: true, bestQuizScore: 80 })
    expect((await getSkillDetails(preview, 'sql'))?.progress).toEqual(firstSql.progress)
    expect(firstSql.skill).toEqual(secondSql.skill)
  })

  it('returns undefined for an unknown skill or empty catalogue without unrelated material requests', async () => {
    const service = createMockService()
    const materials = vi.spyOn(service, 'getLearningResources')
    expect(await getSkillDetails(service, 'missing')).toBeUndefined()
    expect(materials).not.toHaveBeenCalled()
    expect(await getSkillDetails(createMockService({ scenario: 'empty' }), 'html')).toBeUndefined()
  })

  it.each(['', '   ', null])('rejects malformed skill IDs before calling the adapter: %s', async (id) => {
    const service = createMockService()
    const read = vi.spyOn(service, 'getSkill')
    await expect(getSkillDetails(service, id as string)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(read).not.toHaveBeenCalled()
  })

  it('handles absent optional material and quiz explicitly', async () => {
    const service = createMockService()
    vi.spyOn(service, 'getLearningResources').mockResolvedValue([])
    vi.spyOn(service, 'getPracticeTasks').mockResolvedValue([])
    vi.spyOn(service, 'getQuizForSkill').mockResolvedValue(undefined)
    expect(await getSkillDetails(service, 'html')).toMatchObject({ resources: [], unavailableResourceCount: 0, practiceTasks: [], quiz: undefined })
  })

  it('filters unsafe and paid resources while preserving safe resource metadata', async () => {
    const service = createMockService()
    const original = (await service.getLearningResources('html'))[0]
    vi.spyOn(service, 'getLearningResources').mockResolvedValue([
      original,
      { ...original, id: 'script', url: 'javascript:alert(1)' },
      { ...original, id: 'plain-http', url: 'http://example.com' },
      { ...original, id: 'credentials', url: 'https://user:secret@example.com/' },
      { ...original, id: 'paid', url: 'https://example.com/course', isFree: false },
      { ...original, id: 'broken', url: 'not a URL' },
    ])
    const details = (await getSkillDetails(service, 'html'))!
    expect(details.resources).toEqual([original])
    expect(details.unavailableResourceCount).toBe(5)
  })

  it('whitelists public quiz fields even if an adapter accidentally adds grading keys', async () => {
    const service = createMockService()
    const quiz = (await service.getQuizForSkill('html'))!
    const exposed = {
      ...quiz, answerKeys: { secret: 'key' },
      questions: quiz.questions.map((question) => ({
        ...question, correctOptionId: question.options[0].id, explanation: 'Private explanation',
        options: question.options.map((option) => ({ ...option, correct: true })),
      })),
    }
    vi.spyOn(service, 'getQuizForSkill').mockResolvedValue(exposed)
    expect((await getSkillDetails(service, 'html'))?.quiz).toEqual(quiz)
  })

  it.each(['getSkill', 'getSkills', 'getDependencies', 'getProgress', 'getLearningResources', 'getPracticeTasks', 'getQuizForSkill'] as const)('forwards %s failures instead of inventing details', async (method) => {
    await expect(getSkillDetails(createMockService({ failMethods: [method] }), 'html')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  it('rejects a mismatched single-skill response or missing catalogue definition', async () => {
    const mismatch = createMockService()
    vi.spyOn(mismatch, 'getSkill').mockResolvedValue({ id: 'css', name: 'CSS', description: 'Wrong skill' })
    await expect(getSkillDetails(mismatch, 'html')).rejects.toThrow('requested skill')
    const missing = createMockService()
    vi.spyOn(missing, 'getSkills').mockResolvedValue([])
    await expect(getSkillDetails(missing, 'html')).rejects.toThrow('skill catalogue')
  })

  it('rejects dangling or duplicate prerequisite references', async () => {
    const dangling = createMockService()
    vi.spyOn(dangling, 'getDependencies').mockResolvedValue([{ skillId: 'html', prerequisiteId: 'missing' }])
    await expect(getSkillDetails(dangling, 'html')).rejects.toThrow('unavailable prerequisite')
    const duplicate = createMockService()
    const edge = { skillId: 'css', prerequisiteId: 'html' }
    vi.spyOn(duplicate, 'getDependencies').mockResolvedValue([edge, edge])
    await expect(getSkillDetails(duplicate, 'css')).rejects.toThrow('duplicate prerequisites')
  })

  it.each([{ progress: [] }, { progress: [{ userId: 'student', skillId: 'css' }] }])('rejects missing selected-skill progress', async ({ progress }) => {
    const service = createMockService()
    vi.spyOn(service, 'getProgress').mockResolvedValue(progress as UserSkillProgress[])
    await expect(getSkillDetails(service, 'html')).rejects.toThrow('exactly one current-user progress')
  })

  it.each([
    { status: 'invented' }, { verified: 'yes' }, { bestQuizScore: 101 },
    { bestQuizScore: Number.NaN }, { updatedAt: 'not a date' }, { userId: '' },
  ])('rejects malformed selected-skill progress: %j', async (badFields) => {
    const service = createMockService()
    const record = (await service.getProgress()).find((item) => item.skillId === 'html')!
    vi.spyOn(service, 'getProgress').mockResolvedValue([{ ...record, ...badFields } as UserSkillProgress])
    await expect(getSkillDetails(service, 'html')).rejects.toThrow('malformed progress')
  })

  it('rejects duplicate progress records rather than choosing a potentially foreign owner', async () => {
    const service = createMockService()
    const record = (await service.getProgress()).find((item) => item.skillId === 'html')!
    vi.spyOn(service, 'getProgress').mockResolvedValue([record, { ...record, userId: 'other-user' }])
    await expect(getSkillDetails(service, 'html')).rejects.toThrow('exactly one current-user progress')
  })

  it('rejects resources, practice tasks and quizzes belonging to another skill', async () => {
    const material = createMockService()
    const resource = (await material.getLearningResources('html'))[0]
    vi.spyOn(material, 'getLearningResources').mockResolvedValue([{ ...resource, skillId: 'css' }])
    await expect(getSkillDetails(material, 'html')).rejects.toThrow('malformed learning resource')
    const practice = createMockService()
    const task = (await practice.getPracticeTasks('html'))[0]
    vi.spyOn(practice, 'getPracticeTasks').mockResolvedValue([{ ...task, skillId: 'css' }])
    await expect(getSkillDetails(practice, 'html')).rejects.toThrow('malformed practice task')
    const quizzes = createMockService()
    const quiz = (await quizzes.getQuizForSkill('html'))!
    vi.spyOn(quizzes, 'getQuizForSkill').mockResolvedValue({ ...quiz, skillId: 'css' })
    await expect(getSkillDetails(quizzes, 'html')).rejects.toThrow('malformed quiz')
  })

  it('rejects malformed adapter collections and quiz questions', async () => {
    const collection = createMockService()
    vi.spyOn(collection, 'getLearningResources').mockResolvedValue(null as unknown as LearningResource[])
    await expect(getSkillDetails(collection, 'html')).rejects.toThrow('malformed collection')
    const questions = createMockService()
    const quiz = (await questions.getQuizForSkill('html'))!
    vi.spyOn(questions, 'getQuizForSkill').mockResolvedValue({ ...quiz, questions: [{ id: 'q', prompt: 'Prompt', options: null }] } as unknown as Quiz)
    await expect(getSkillDetails(questions, 'html')).rejects.toThrow('malformed quiz question')
  })

  it('returns independent detail objects so UI edits cannot mutate adapter responses', async () => {
    const service = createMockService()
    const details = (await getSkillDetails(service, 'css'))!
    details.skill.name = 'Edited'
    details.prerequisites[0].name = 'Edited'
    details.resources[0].title = 'Edited'
    details.practiceTasks[0].description = 'Edited'
    details.progress.status = 'completed'
    const fresh = (await getSkillDetails(service, 'css'))!
    expect(fresh.skill.name).toBe('CSS')
    expect(fresh.prerequisites[0].name).toBe('HTML')
    expect(fresh.resources[0].title).not.toBe('Edited')
    expect(fresh.practiceTasks[0].description).not.toBe('Edited')
    expect(fresh.progress.status).toBe('learning')
  })
})
