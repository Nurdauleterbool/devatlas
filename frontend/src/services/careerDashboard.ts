import type { Analytics, Recommendation } from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'
import { getCareerRoadmaps } from './careerRoadmaps'
import type { CareerRoadmap, RoadmapSkill } from './careerRoadmaps'

export interface DashboardRecommendation {
  skill: RoadmapSkill
  paths: { name: string; reason: string }[]
}

export interface CareerDashboard {
  careers: CareerRoadmap[]
  selectedIds: string[]
  selected: CareerRoadmap[]
  analytics: Analytics | null
  skills: RoadmapSkill[]
  completed: RoadmapSkill[]
  verified: RoadmapSkill[]
  gaps: RoadmapSkill[]
  completionPercent: number
  recommendations: DashboardRecommendation[]
}

/** Presentation composition only: scoring, eligibility and reasons belong to the adapter. */
export async function getCareerDashboard(service: DevAtlasService, signedIn: boolean): Promise<CareerDashboard> {
  const [careers, selections, analytics] = await Promise.all([
    getCareerRoadmaps(service),
    signedIn ? service.getSelectedCareers() : Promise.resolve([]),
    signedIn ? service.getAnalytics() : Promise.resolve(null),
  ])
  const selectedIds = selections.map((selection) => selection.careerId)
  const selected = selectedIds.map((id) => {
    const career = careers.find((item) => item.id === id)
    if (!career) throw new ServiceError('VALIDATION', 'Selected career is unavailable.')
    return career
  })
  if (analytics && selected.some((career) => !analytics.careers.some((item) => item.careerId === career.id))) {
    throw new ServiceError('VALIDATION', 'Selected career analytics are unavailable.')
  }
  const skills = [...new Map(selected.flatMap((career) => career.skills).map((skill) => [skill.id, skill])).values()]
  const completed = skills.filter((skill) => skill.progress.status === 'completed')
  const verified = skills.filter((skill) => skill.progress.verified)
  // A skill gap is still self-reported as unfinished; verification is displayed independently.
  const gaps = skills.filter((skill) => skill.progress.status !== 'completed')
  const ranked = await Promise.all(selected.map(async (career) => ({ career, items: await service.getRecommendations(career.id) })))
  const recommendations = new Map<string, DashboardRecommendation>()
  for (const { career, items } of ranked) {
    for (const item of [...items].sort((a: Recommendation, b: Recommendation) => a.rank - b.rank)) {
      const skill = career.skills.find((skill) => skill.id === item.skillId)
      if (!skill) throw new ServiceError('VALIDATION', 'Recommended skill is unavailable in its career.')
      const entry = recommendations.get(skill.id) ?? { skill, paths: [] }
      entry.paths.push({ name: career.name, reason: item.reason })
      recommendations.set(skill.id, entry)
    }
  }
  return {
    careers, selectedIds, selected, analytics, skills, completed, verified, gaps,
    completionPercent: skills.length ? Math.round(completed.length / skills.length * 100) : 0,
    recommendations: [...recommendations.values()],
  }
}

/** Serialize full-set writes; skip queued intents superseded before they start. */
export function createCareerSelectionWriter(service: Pick<DevAtlasService, 'setSelectedCareers'>) {
  let latest = 0
  let tail = Promise.resolve()
  const write = (ids: string[]): Promise<boolean> => {
    const revision = ++latest
    const snapshot = [...ids]
    const pending = tail.then(async () => {
      if (revision !== latest) return false
      await service.setSelectedCareers(snapshot)
      return revision === latest
    })
    tail = pending.then(() => undefined, () => undefined)
    return pending
  }
  return Object.assign(write, { cancelPending: () => { latest++ } })
}
