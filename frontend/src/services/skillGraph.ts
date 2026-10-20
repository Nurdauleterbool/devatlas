import type { Skill, SkillStatus } from '../types/domain'
import type { CareerRoadmap } from './careerRoadmaps'
import { ServiceError } from './DevAtlasService'

export type SkillGraphStatus = 'completed' | 'learning' | 'available' | 'locked' | 'verified'

export interface SkillGraphData extends Record<string, unknown> {
  skillId: string
  name: string
  description: string
  status: SkillGraphStatus
  assessment: SkillStatus
  verified: boolean
  missingPrerequisites: Skill[]
}

export interface SkillGraphModel {
  nodes: {
    id: string
    type: 'skill'
    position: { x: number; y: number }
    data: SkillGraphData
  }[]
  edges: { id: string; source: string; target: string }[]
}

/** Compose a path's graph from the adapter-backed roadmap, without a second data store. */
export function buildSkillGraph(career: CareerRoadmap): SkillGraphModel {
  const fail = (message: string): never => {
    throw new ServiceError('VALIDATION', message)
  }
  const skillMap = new Map(career.skills.map((skill) => [skill.id, skill]))
  const ids = new Set(career.skillIds)
  if (ids.size !== career.skillIds.length || skillMap.size !== career.skills.length) {
    fail('Career graph contains duplicate skills.')
  }
  if (ids.size !== skillMap.size || [...ids].some((id) => !id || !skillMap.has(id))) {
    fail('Career graph skills do not match the path.')
  }
  // Authored path order makes layout and keyboard/list ordering deterministic.
  const skills = career.skillIds.map((id) => skillMap.get(id)!)
  for (const skill of skills) {
    const prerequisites = new Set<string>()
    for (const prerequisite of skill.prerequisites) {
      if (!skillMap.has(prerequisite.id)) fail(`Career graph prerequisite is unavailable: ${prerequisite.id}`)
      if (prerequisites.has(prerequisite.id)) fail(`Career graph contains a duplicate prerequisite: ${prerequisite.id}`)
      prerequisites.add(prerequisite.id)
    }
  }

  const visiting = new Set<string>()
  const levels = new Map<string, number>()
  function level(id: string): number {
    const known = levels.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) fail('Career graph contains a prerequisite cycle.')
    visiting.add(id)
    const skill = skillMap.get(id)!
    const value = skill.prerequisites.reduce((depth, prerequisite) => Math.max(depth, level(prerequisite.id) + 1), 0)
    visiting.delete(id)
    levels.set(id, value)
    return value
  }

  const rows = new Map<number, number>()
  const nodes = skills.map((skill) => {
    const depth = level(skill.id)
    const row = rows.get(depth) ?? 0
    rows.set(depth, row + 1)
    const missingPrerequisites = skill.prerequisites.filter((prerequisite) => {
      const progress = skillMap.get(prerequisite.id)!.progress
      return progress.status !== 'completed' && !progress.verified
    }).map(({ id, name, description }) => ({ id, name, description }))
    const status: SkillGraphStatus = skill.progress.verified ? 'verified'
      : skill.progress.status === 'completed' ? 'completed'
      : missingPrerequisites.length ? 'locked'
      : skill.progress.status === 'learning' ? 'learning' : 'available'
    return {
      id: skill.id,
      type: 'skill' as const,
      position: { x: depth * 300, y: row * 180 },
      data: {
        skillId: skill.id, name: skill.name, description: skill.description,
        status, assessment: skill.progress.status, verified: skill.progress.verified,
        missingPrerequisites,
      },
    }
  })
  const edges = skills.flatMap((skill) => skill.prerequisites.map((prerequisite) => ({
    // JSON tuples avoid collisions when service identifiers contain separators.
    id: JSON.stringify([prerequisite.id, skill.id]),
    source: prerequisite.id,
    target: skill.id,
  })))
  return { nodes, edges }
}
