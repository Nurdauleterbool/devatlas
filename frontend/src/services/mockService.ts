
export type SkillStatus = 'not_started' | 'learning' | 'completed'

export interface Skill {
  id: string
  name: string
  status: SkillStatus
  prerequisites: string[]
}

export interface CareerPath {
  id: string
  name: string
  description: string
  skills: Skill[]
}

const careerPaths: CareerPath[] = [
  {
    id: 'frontend',
    name: 'Frontend Developer',
    description: 'Build modern websites and interactive interfaces.',
    skills: [
      { id: 'html', name: 'HTML', status: 'completed', prerequisites: [] },
      { id: 'css', name: 'CSS', status: 'learning', prerequisites: ['html'] },
      { id: 'javascript', name: 'JavaScript', status: 'not_started', prerequisites: ['html'] },
      { id: 'react', name: 'React', status: 'not_started', prerequisites: ['javascript'] },
    ],
  },
  {
    id: 'backend',
    name: 'Backend Developer',
    description: 'Create APIs, databases, and server applications.',
    skills: [
      { id: 'python', name: 'Python', status: 'learning', prerequisites: [] },
      { id: 'sql', name: 'SQL', status: 'not_started', prerequisites: [] },
      { id: 'fastapi', name: 'FastAPI', status: 'not_started', prerequisites: ['python'] },
      { id: 'databases', name: 'Databases', status: 'not_started', prerequisites: ['sql'] },
    ],
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    description: 'Analyze data and discover useful insights.',
    skills: [
      { id: 'python', name: 'Python', status: 'learning', prerequisites: [] },
      { id: 'pandas', name: 'Pandas', status: 'not_started', prerequisites: ['python'] },
      { id: 'statistics', name: 'Statistics', status: 'not_started', prerequisites: [] },
      { id: 'sql', name: 'SQL', status: 'not_started', prerequisites: [] },
    ],
  },
]

export const mockService = {
  async getCareerPaths(): Promise<CareerPath[]> {
    return structuredClone(careerPaths)
  },

  async getCareerPath(id: string): Promise<CareerPath | undefined> {
    const career = careerPaths.find((path) => path.id === id)
    return career ? structuredClone(career) : undefined
  },
}
