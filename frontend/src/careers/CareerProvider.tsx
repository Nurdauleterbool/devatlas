import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DevAtlasService } from '../services/DevAtlasService'
import { createCareerSelectionWriter, getCareerDashboard } from '../services/careerDashboard'
import type { CareerDashboard } from '../services/careerDashboard'
import { CareerContext } from './careerContext'

export default function CareerProvider({ service, signedIn, children }: { service: DevAtlasService; signedIn: boolean; children: ReactNode }) {
  const [data, setData] = useState<CareerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pendingIds, setPendingIds] = useState<string[] | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const revision = useRef(0)
  const mounted = useRef(true)
  const lastIntent = useRef<string[]>([])
  const write = useMemo(() => createCareerSelectionWriter(service), [service])

  useEffect(() => {
    mounted.current = true
    const version = ++revision.current
    getCareerDashboard(service, signedIn).then((value) => {
      if (mounted.current && version === revision.current) setData(value)
    }).catch(() => {
      if (mounted.current && version === revision.current) setError(true)
    }).finally(() => {
      if (mounted.current && version === revision.current) setLoading(false)
    })
    return () => { mounted.current = false; write.cancelPending() }
  }, [service, signedIn, retryKey, write])

  async function select(ids: string[]) {
    if (!signedIn) return
    const version = ++revision.current
    lastIntent.current = [...ids]
    setPendingIds([...ids])
    setSaving(true)
    setSaveError(false)
    setSaved(false)
    try {
      if (!await write(ids)) return
      const value = await getCareerDashboard(service, signedIn)
      if (mounted.current && version === revision.current) {
        setData(value)
        setSaved(true)
      }
    } catch {
      if (mounted.current && version === revision.current) setSaveError(true)
    } finally {
      if (mounted.current && version === revision.current) {
        setSaving(false)
        setPendingIds(null)
      }
    }
  }

  return <CareerContext.Provider value={{
    data, loading, error, saving, saveError, saved, signedIn, pendingIds,
    select: (ids) => { void select(ids) },
    retry: () => { setLoading(true); setError(false); setRetryKey((value) => value + 1) },
    retrySave: () => { void select(lastIntent.current) },
  }}>{children}</CareerContext.Provider>
}
