import { createContext, useContext } from 'react'
import type { CareerDashboard } from '../services/careerDashboard'

export interface CareerWorkspace {
  data: CareerDashboard | null
  loading: boolean
  error: boolean
  saving: boolean
  saveError: boolean
  saved: boolean
  signedIn: boolean
  pendingIds: string[] | null
  select: (ids: string[]) => void
  retry: () => void
  retrySave: () => void
}
export const CareerContext = createContext<CareerWorkspace | null>(null)
export function useCareers() {
  const context = useContext(CareerContext)
  if (!context) throw new Error('Career workspace is unavailable.')
  return context
}
