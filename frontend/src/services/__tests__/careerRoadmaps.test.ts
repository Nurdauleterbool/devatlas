import { describe, expect, it, vi } from 'vitest'
import { getCareerRoadmaps } from '../careerRoadmaps'
import { createMockService } from '../mockService'

describe('adapter-independent career roadmaps', () => {
  it('joins catalogue, dependencies and session progress through the service interface', async () => {
    const service = createMockService()
    const paths = await getCareerRoadmaps(service)
    expect(paths[0].skills.map((skill) => skill.id)).toEqual(['html', 'css', 'javascript', 'react'])
    expect(paths[0].skills[0].progress.status).toBe('completed')
    expect(paths[0].skills[3].prerequisites.map((skill) => skill.name)).toEqual(['JavaScript'])
    const python = paths.flatMap((path) => path.skills).filter((skill) => skill.id === 'python')
    expect(python).toHaveLength(2)
    expect(python[0]).toEqual(python[1])
  })

  it('shows updated shared progress consistently in both careers without changing definitions', async () => {
    const service = createMockService()
    await service.updateProgress({ skillId: 'sql', status: 'completed' })
    const paths = await getCareerRoadmaps(service)
    const sql = paths.flatMap((path) => path.skills).filter((skill) => skill.id === 'sql')
    expect(sql).toHaveLength(2)
    expect(sql.every((skill) => skill.progress.status === 'completed')).toBe(true)
    expect(await service.getSkill('sql')).not.toHaveProperty('status')
  })

  it('supports the empty adapter state and forwards request failures', async () => {
    expect(await getCareerRoadmaps(createMockService({ scenario: 'empty' }))).toEqual([])
    await expect(getCareerRoadmaps(createMockService({ failMethods: ['getProgress'] }))).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  it('rejects inconsistent adapter responses instead of silently dropping roadmap data', async () => {
    const missingSkill = createMockService()
    vi.spyOn(missingSkill, 'getSkills').mockResolvedValue([])
    await expect(getCareerRoadmaps(missingSkill)).rejects.toThrow('unavailable skill')
    const missingProgress = createMockService()
    vi.spyOn(missingProgress, 'getProgress').mockResolvedValue([])
    await expect(getCareerRoadmaps(missingProgress)).rejects.toThrow('missing progress')
  })
})
