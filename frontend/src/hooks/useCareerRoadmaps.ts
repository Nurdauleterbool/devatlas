import { useEffect, useState } from 'react'
import type { CareerRoadmap } from '../services/careerRoadmaps'
import { getCareerRoadmaps } from '../services/careerRoadmaps'
import type { DevAtlasService } from '../services/DevAtlasService'

export function useCareerRoadmaps(service: DevAtlasService) {
  const [careers, setCareers] = useState<CareerRoadmap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    getCareerRoadmaps(service).then((data) => {
      if (!active) return
      setCareers(data)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError(true)
      setLoading(false)
    })
    return () => { active = false }
  }, [service])

  return { careers, loading, error }
}
