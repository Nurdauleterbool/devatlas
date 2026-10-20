import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthSession } from '../types/domain'
import type { DevAtlasService } from '../services/DevAtlasService'
import { AuthContext } from './authContext'

export default function AuthProvider({ children, service }: { children: ReactNode; service: DevAtlasService }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [pending, setPending] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const revision = useRef(0)

  useEffect(() => {
    let active = true
    const started = revision.current
    service.getSession().then((value) => {
      if (active && started === revision.current) setSession(value)
    }).catch(() => {
      if (active && started === revision.current) setSessionError(true)
    }).finally(() => {
      if (active && started === revision.current) setInitializing(false)
    })
    return () => { active = false }
  }, [service])

  async function run(action: () => Promise<AuthSession | void>) {
    const started = ++revision.current
    setPending(true)
    try {
      const value = await action()
      if (started === revision.current) {
        setSession(value ?? null)
        setSessionError(false)
      }
      return value
    } finally {
      if (started === revision.current) {
        setPending(false)
        setInitializing(false)
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      session, initializing, pending, sessionError,
      signUp: async (input) => (await run(() => service.signUp(input)))!,
      logIn: async (input) => (await run(() => service.logIn(input)))!,
      logInDemo: async () => (await run(() => service.logInDemo()))!,
      logOut: async () => { await run(() => service.logOut()) },
    }}>
      {children}
    </AuthContext.Provider>
  )
}
