import { describe, expect, it } from 'vitest'
import { seedFixtures } from '../fixtures'
import type { MockFixtures } from '../fixtures'
import { validateFixtures } from '../fixtures/validateFixtures'

describe('seed catalogue', () => {
  it('has three coherent careers and one definition per shared skill', () => {
    expect(() => validateFixtures(seedFixtures)).not.toThrow()
    expect(seedFixtures.careerPaths.map((career) => career.id)).toEqual(['frontend', 'backend', 'analyst'])
    expect(seedFixtures.skills).toHaveLength(10)
    for (const id of ['python', 'sql']) {
      expect(seedFixtures.skills.filter((skill) => skill.id === id)).toHaveLength(1)
      expect(seedFixtures.careerPaths.filter((career) => career.skillIds.includes(id))).toHaveLength(2)
    }
    for (const skill of seedFixtures.skills) {
      expect(skill).not.toHaveProperty('status')
      expect(skill).not.toHaveProperty('userId')
      expect(skill).not.toHaveProperty('verified')
    }
  })

  it('covers every skill with a free resource, practical task, and a five-question quiz', () => {
    for (const skill of seedFixtures.skills) {
      const resources = seedFixtures.learningResources.filter((item) => item.skillId === skill.id)
      expect(resources.length).toBeGreaterThan(0)
      expect(resources.every((item) => item.isFree && item.url.startsWith('https://'))).toBe(true)
      expect(seedFixtures.practiceTasks.some((item) => item.skillId === skill.id)).toBe(true)
      const quiz = seedFixtures.quizzes.find((item) => item.skillId === skill.id)!
      expect(quiz.questions).toHaveLength(5)
      expect(quiz.passThreshold).toBe(80)
      for (const question of quiz.questions) {
        expect(question.options).toHaveLength(4)
        expect(question).not.toHaveProperty('explanation')
        expect(question).not.toHaveProperty('correctOptionId')
      }
    }
  })

  it('has dated, reproducible per-user progress and attempts', () => {
    expect(seedFixtures.progress.find((item) => item.userId === 'demo-student' && item.skillId === 'html')?.status).toBe('completed')
    expect(seedFixtures.attempts.map((attempt) => attempt.score)).toEqual([60, 80])
    expect(seedFixtures.attempts.map((attempt) => attempt.passed)).toEqual([false, true])
    expect(seedFixtures).toEqual(structuredClone(seedFixtures))
  })

  const corruptions: [string, (fixtures: MockFixtures) => void][] = [
    ['duplicate skill', (seed) => { seed.skills.push(seed.skills[0]) }],
    ['unknown dependency', (seed) => { seed.dependencies[0].prerequisiteId = 'missing' }],
    ['dependency cycle', (seed) => { seed.dependencies.push({ skillId: 'html', prerequisiteId: 'css' }) }],
    ['missing career prerequisite', (seed) => { seed.careerPaths[0].skillIds = ['react'] }],
    ['duplicate career skill', (seed) => { seed.careerPaths[0].skillIds.push('html') }],
    ['non-HTTPS resource', (seed) => { seed.learningResources[0].url = 'http://example.test' }],
    ['malformed resource URL', (seed) => { seed.learningResources[0].url = 'invalid' }],
    ['foreign progress owner', (seed) => { seed.progress[0].userId = 'missing' }],
    ['duplicate progress', (seed) => { seed.progress.push(seed.progress[0]) }],
    ['incoherent history', (seed) => { seed.history[0].fromStatus = 'completed' }],
    ['invalid timestamp', (seed) => { seed.progress[0].updatedAt = 'not-a-date' }],
    ['missing quiz key', (seed) => { delete seed.answerKeys['html-q1'] }],
    ['incorrect answer count', (seed) => { seed.quizzes[0].questions[0].options.pop() }],
    ['incorrect attempt score', (seed) => { seed.attempts[0].score = 100 }],
    ['invalid selection', (seed) => { seed.selectedCareers[0].careerId = 'missing' }],
  ]
  it.each(corruptions)('rejects %s fixtures before use', (_label, corrupt) => {
    const seed = structuredClone(seedFixtures)
    corrupt(seed)
    expect(() => validateFixtures(seed)).toThrow('Invalid fixtures:')
  })
})
