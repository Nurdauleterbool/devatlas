import { createContext, useContext } from 'react'
import type { AuthSession, LoginInput, SignUpInput } from '../types/domain'

export interface AuthState {
  session: AuthSession | null
  initializing: boolean
  pending: boolean
  sessionError: boolean
  signUp: (input: SignUpInput) => Promise<AuthSession>
  logIn: (input: LoginInput) => Promise<AuthSession>
  logInDemo: () => Promise<AuthSession>
  logOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('Authentication context is unavailable.')
  return context
}
