import type { LearningResource, PracticeTask, Quiz, Skill, UserSkillProgress } from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'

export interface SkillDetails {
  skill: Skill
  prerequisites: Skill[]
  resources: LearningResource[]
  unavailableResourceCount: number
  practiceTasks: PracticeTask[]
  quiz: Quiz | undefined
  progress: UserSkillProgress
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
function invalid(message: string): never {
  throw new ServiceError('VALIDATION', message)
}
function copySkill(skill: Skill): Skill {
  if (!skill || !nonempty(skill.id) || !nonempty(skill.name) || typeof skill.description !== 'string') {
    invalid('Skill details contain a malformed skill.')
  }
  return { id: skill.id, name: skill.name, description: skill.description }
}

/** Return a canonical HTTPS link suitable for an external anchor, never executable schemes. */
export function safeResourceUrl(value: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null
    const host = url.hostname.replace(/\.$/, '')
    // URL already validates bracketed IPv6 and normalizes IPv4/IDN hosts.
    if (!host.startsWith('[') && (host.length > 253 || !host.split('.').every((label) =>
      label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    ))) return null
    return url.href
  } catch {
    return null
  }
}

export function publicQuiz(quiz: Quiz | undefined, skillId: string): Quiz | undefined {
  if (quiz === undefined) return undefined
  if (!quiz || quiz.skillId !== skillId || !nonempty(quiz.id) || !nonempty(quiz.title)
    || !Number.isFinite(quiz.passThreshold) || quiz.passThreshold < 0 || quiz.passThreshold > 100 || !Array.isArray(quiz.questions)) {
    invalid('Skill details contain a malformed quiz.')
  }
  const questionIds = new Set<string>()
  const questions = quiz.questions.map((question) => {
    if (!question || !nonempty(question.id) || !nonempty(question.prompt) || !Array.isArray(question.options)
      || questionIds.has(question.id)) invalid('Skill details contain a malformed quiz question.')
    questionIds.add(question.id)
    const optionIds = new Set<string>()
    const options = question.options.map((option) => {
      if (!option || !nonempty(option.id) || !nonempty(option.text) || optionIds.has(option.id)) {
        invalid('Skill details contain a malformed quiz option.')
      }
      optionIds.add(option.id)
      return { id: option.id, text: option.text }
    })
    return { id: question.id, prompt: question.prompt, options }
  })
  // Copy only public contract fields, even if an adapter accidentally returns internal keys.
  return { id: quiz.id, skillId, title: quiz.title, passThreshold: quiz.passThreshold, questions }
}

/** Read the selected skill through the session-scoped adapter; pages never supply an owner ID. */
export async function getSkillDetails(service: DevAtlasService, skillId: string): Promise<SkillDetails | undefined> {
  if (!nonempty(skillId)) invalid('Skill ID must be a nonempty string.')
  const skill = await service.getSkill(skillId)
  if (skill === undefined) return undefined
  const selected = copySkill(skill)
  if (selected.id !== skillId) invalid('Skill details do not match the requested skill.')
  const [skills, dependencies, progress, resources, practiceTasks, quiz] = await Promise.all([
    service.getSkills(), service.getDependencies(), service.getProgress(),
    service.getLearningResources(skillId), service.getPracticeTasks(skillId), service.getQuizForSkill(skillId),
  ])
  if (![skills, dependencies, progress, resources, practiceTasks].every(Array.isArray)) {
    invalid('Skill details contain a malformed collection.')
  }
  const skillMap = new Map<string, Skill>()
  for (const item of skills) {
    const copied = copySkill(item)
    if (skillMap.has(copied.id)) invalid('Skill details contain duplicate catalogue skills.')
    skillMap.set(copied.id, copied)
  }
  const catalogueSkill = skillMap.get(skillId)
  if (!catalogueSkill || catalogueSkill.name !== selected.name || catalogueSkill.description !== selected.description) {
    invalid('Skill details do not match the skill catalogue.')
  }
  const seenEdges = new Set<string>()
  const prerequisites: Skill[] = []
  for (const edge of dependencies) {
    if (!edge || !skillMap.has(edge.skillId) || !skillMap.has(edge.prerequisiteId) || edge.skillId === edge.prerequisiteId) {
      invalid('Skill details contain an unavailable prerequisite reference.')
    }
    const id = JSON.stringify([edge.prerequisiteId, edge.skillId])
    if (seenEdges.has(id)) invalid('Skill details contain duplicate prerequisites.')
    seenEdges.add(id)
    if (edge.skillId === skillId) prerequisites.push({ ...skillMap.get(edge.prerequisiteId)! })
  }
  const records = progress.filter((item) => item?.skillId === skillId)
  if (records.length !== 1) invalid('Skill details require exactly one current-user progress record.')
  const record = records[0]
  if (!nonempty(record.userId) || !['not_started', 'learning', 'completed'].includes(record.status)
    || typeof record.verified !== 'boolean' || !nonempty(record.updatedAt) || !Number.isFinite(Date.parse(record.updatedAt))
    || (record.bestQuizScore !== null && (!Number.isFinite(record.bestQuizScore) || record.bestQuizScore < 0 || record.bestQuizScore > 100))) {
    invalid('Skill details contain malformed progress.')
  }
  const safeResources: LearningResource[] = []
  for (const resource of resources) {
    if (!resource || resource.skillId !== skillId || !nonempty(resource.id) || !nonempty(resource.title)
      || !['documentation', 'course', 'video'].includes(resource.kind) || typeof resource.isFree !== 'boolean') {
      invalid('Skill details contain a malformed learning resource.')
    }
    const url = safeResourceUrl(resource.url)
    if (url && resource.isFree) safeResources.push({ ...resource, url })
  }
  const tasks = practiceTasks.map((task) => {
    if (!task || task.skillId !== skillId || !nonempty(task.id) || !nonempty(task.title) || typeof task.description !== 'string') {
      invalid('Skill details contain a malformed practice task.')
    }
    return { ...task }
  })
  return {
    skill: selected, prerequisites, resources: safeResources,
    unavailableResourceCount: resources.length - safeResources.length,
    practiceTasks: tasks, quiz: publicQuiz(quiz, skillId),
    progress: {
      userId: record.userId, skillId, status: record.status, verified: record.verified,
      bestQuizScore: record.bestQuizScore, updatedAt: record.updatedAt,
    },
  }
}
