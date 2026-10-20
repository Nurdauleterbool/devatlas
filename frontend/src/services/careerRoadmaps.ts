import type { CareerPath, Skill, UserSkillProgress } from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'

export interface RoadmapSkill extends Skill {
  progress: UserSkillProgress
  prerequisites: Skill[]
}

export interface CareerRoadmap extends CareerPath {
  skills: RoadmapSkill[]
}

/** Adapter-independent view composition; all data is read through the public service contract. */
export async function getCareerRoadmaps(service: DevAtlasService): Promise<CareerRoadmap[]> {
  const [careers, skills, dependencies, progress] = await Promise.all([
    service.getCareerPaths(), service.getSkills(), service.getDependencies(), service.getProgress(),
  ])
  const skillMap = new Map(skills.map((skill) => [skill.id, skill]))
  const progressMap = new Map(progress.map((item) => [item.skillId, item]))
  function knownSkill(id: string) {
    const skill = skillMap.get(id)
    if (!skill) throw new ServiceError('VALIDATION', `Career roadmap references an unavailable skill: ${id}`)
    return skill
  }
  return careers.map((career) => ({
    ...career,
    skills: career.skillIds.map((id) => {
      const userProgress = progressMap.get(id)
      if (!userProgress) throw new ServiceError('VALIDATION', `Career roadmap is missing progress for skill: ${id}`)
      return {
        ...knownSkill(id), progress: userProgress,
        prerequisites: dependencies.filter((edge) => edge.skillId === id).map((edge) => knownSkill(edge.prerequisiteId)),
      }
    }),
  }))
}
