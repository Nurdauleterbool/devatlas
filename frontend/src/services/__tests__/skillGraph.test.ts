import { describe, expect, it } from 'vitest'
import type { SkillStatus } from '../../types/domain'
import type { CareerRoadmap, RoadmapSkill } from '../careerRoadmaps'
import { getCareerRoadmaps } from '../careerRoadmaps'
import { createMockService } from '../mockService'
import { buildSkillGraph } from '../skillGraph'

function skill(id: string, prerequisites: string[] = [], status: SkillStatus = 'not_started', verified = false): RoadmapSkill {
  return {
    id, name: id.toUpperCase(), description: `${id} description`,
    prerequisites: prerequisites.map((id) => ({ id, name: id.toUpperCase(), description: `${id} description` })),
    progress: { userId: 'student', skillId: id, status, verified, bestQuizScore: verified ? 80 : null, updatedAt: '2026-10-20T00:00:00.000Z' },
  }
}
function career(skills: RoadmapSkill[]): CareerRoadmap {
  return { id: 'path', name: 'Path', description: 'Test path', skillIds: skills.map((item) => item.id), skills }
}

describe('skill graph transformation', () => {
  it('renders every seeded path skill and directed prerequisite without foreign nodes', async () => {
    const service = createMockService()
    const dependencies = await service.getDependencies()
    const roadmaps = await getCareerRoadmaps(service)
    expect(roadmaps).toHaveLength(3)
    for (const roadmap of roadmaps) {
      const graph = buildSkillGraph(roadmap)
      expect(graph.nodes.map((node) => node.id)).toEqual(roadmap.skillIds)
      expect(graph.nodes).toHaveLength(4)
      expect(graph.edges.map(({ source, target }) => ({ prerequisiteId: source, skillId: target }))).toEqual(
        dependencies.filter((edge) => roadmap.skillIds.includes(edge.skillId)),
      )
      expect(graph.edges.every((edge) => roadmap.skillIds.includes(edge.source) && roadmap.skillIds.includes(edge.target))).toBe(true)
    }
  })

  it('places chains and branches in deterministic non-overlapping prerequisite levels', () => {
    const path = career([skill('root'), skill('left', ['root']), skill('right', ['root']), skill('leaf', ['left', 'right'])])
    const graph = buildSkillGraph(path)
    expect(graph.nodes.map(({ id, position }) => ({ id, ...position }))).toEqual([
      { id: 'root', x: 0, y: 0 },
      { id: 'left', x: 300, y: 0 },
      { id: 'right', x: 300, y: 180 },
      { id: 'leaf', x: 600, y: 0 },
    ])
    expect(graph.edges.map(({ source, target }) => [source, target])).toEqual([
      ['root', 'left'], ['root', 'right'], ['left', 'leaf'], ['right', 'leaf'],
    ])
    const reverseInput = { ...path, skills: [...path.skills].reverse() }
    expect(buildSkillGraph(reverseInput)).toEqual(graph)
  })

  it('uses topological levels even when a prerequisite appears later in authored order', () => {
    const graph = buildSkillGraph(career([skill('next', ['first']), skill('first')]))
    expect(graph.nodes.map(({ id, position }) => ({ id, x: position.x }))).toEqual([
      { id: 'next', x: 300 }, { id: 'first', x: 0 },
    ])
    expect(graph.edges[0]).toMatchObject({ source: 'first', target: 'next' })
  })

  it('distinguishes all visual states while keeping self-assessment independent of verification', () => {
    const graph = buildSkillGraph(career([
      skill('done', [], 'completed'),
      skill('learning', ['done'], 'learning'),
      skill('available', ['done']),
      skill('locked', ['learning']),
      skill('verified', ['locked'], 'not_started', true),
    ]))
    expect(graph.nodes.map((node) => node.data.status)).toEqual(['completed', 'learning', 'available', 'locked', 'verified'])
    expect(graph.nodes[4].data).toMatchObject({ assessment: 'not_started', verified: true })
    expect(graph.nodes[4].data.missingPrerequisites.map((item) => item.id)).toEqual(['locked'])
  })

  it('unlocks dependents when every prerequisite is completed or verified', () => {
    const graph = buildSkillGraph(career([
      skill('completed', [], 'completed'),
      skill('verified', [], 'learning', true),
      skill('next', ['completed', 'verified']),
    ]))
    expect(graph.nodes[2].data.status).toBe('available')
    expect(graph.nodes[2].data.missingPrerequisites).toEqual([])
  })

  it('explains exactly the unsatisfied prerequisites and does not treat learning as complete', () => {
    const path = career([
      skill('completed', [], 'completed'), skill('learning', [], 'learning'),
      skill('new'), skill('next', ['completed', 'learning', 'new'], 'learning'),
    ])
    const graph = buildSkillGraph(path)
    expect(graph.nodes[3].data.status).toBe('locked')
    expect(graph.nodes[3].data.missingPrerequisites).toEqual([
      { id: 'learning', name: 'LEARNING', description: 'learning description' },
      { id: 'new', name: 'NEW', description: 'new description' },
    ])
    expect(graph.nodes[3].data.assessment).toBe('learning')
  })

  it('shows completed self-assessment even when prerequisites are unfinished', () => {
    const graph = buildSkillGraph(career([skill('first'), skill('known', ['first'], 'completed')]))
    expect(graph.nodes[1].data.status).toBe('completed')
    expect(graph.nodes[1].data.missingPrerequisites[0].id).toBe('first')
  })

  it('handles an empty path without nodes or edges', () => {
    expect(buildSkillGraph(career([]))).toEqual({ nodes: [], edges: [] })
  })

  it('does not mutate the roadmap or expose mutable prerequisite objects', () => {
    const path = career([skill('first'), skill('next', ['first'])])
    const before = structuredClone(path)
    const graph = buildSkillGraph(path)
    graph.nodes[1].data.missingPrerequisites[0].name = 'Edited result'
    graph.nodes[0].position.x = 999
    expect(path).toEqual(before)
    expect(buildSkillGraph(path).nodes[0].position.x).toBe(0)
  })

  it.each([
    career([skill('same'), skill('same')]),
    { ...career([skill('first')]), skillIds: ['first', 'first'] },
  ])('rejects duplicate path or roadmap skills', (path) => {
    expect(() => buildSkillGraph(path)).toThrow('duplicate skills')
  })

  it.each([
    { ...career([skill('first')]), skillIds: ['missing'] },
    { ...career([skill('first')]), skillIds: [] },
    career([skill('')]),
  ])('rejects missing, empty or unrelated path nodes', (path) => {
    expect(() => buildSkillGraph(path)).toThrow('do not match the path')
  })

  it('rejects unknown prerequisite references instead of emitting dangling edges', () => {
    expect(() => buildSkillGraph(career([skill('next', ['missing'])]))).toThrow('prerequisite is unavailable: missing')
  })

  it('rejects duplicate prerequisites instead of emitting duplicate edge IDs', () => {
    expect(() => buildSkillGraph(career([skill('first'), skill('next', ['first', 'first'])]))).toThrow('duplicate prerequisite: first')
  })

  it.each([
    career([skill('self', ['self'])]),
    career([skill('a', ['b']), skill('b', ['c']), skill('c', ['a'])]),
  ])('rejects cycles rather than looping during layout', (path) => {
    expect(() => buildSkillGraph(path)).toThrow('prerequisite cycle')
  })

  it('gives distinct edge IDs even when skill IDs contain separators', () => {
    const graph = buildSkillGraph(career([
      skill('a-b'), skill('c', ['a-b']), skill('a'), skill('b-c', ['a']),
    ]))
    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(2)
  })
})
