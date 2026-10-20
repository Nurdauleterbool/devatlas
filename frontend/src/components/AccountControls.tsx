import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import Button from './ui/Button'

export default function AccountControls({ onNavigate }: { onNavigate?: () => void }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const busy = useRef(false)

  async function logout() {
    if (busy.current) return
    busy.current = true
    setError('')
    try {
      await auth.logOut()
      onNavigate?.()
      navigate('/login', { replace: true, state: { signedOut: true } })
    } catch {
      setError('Could not log out. Your mock session is still active. Try again.')
    } finally {
      busy.current = false
    }
  }

  return (
    <section aria-label="Mock account" className="border-b border-white/10 pb-5 text-sm">
      {auth.initializing ? <p aria-live="polite" className="text-slate-400">Checking mock session…</p> : auth.session ? (
        <>
          <p className="break-words font-semibold">{auth.session.user.displayName}</p>
          <p className="mt-1 text-xs text-indigo-300">Signed in · mock account</p>
          <Button variant="ghost" className="mt-2 w-full" disabled={auth.pending} onClick={logout}>
            {auth.pending ? 'Please wait…' : 'Log out'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-slate-400">Preview · sample progress</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <Link to="/login" onClick={onNavigate} className="inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">Log in</Link>
            <Link to="/signup" onClick={onNavigate} className="inline-flex min-h-11 items-center text-slate-200 hover:underline">Sign up</Link>
          </div>
          {auth.sessionError && <p aria-live="polite" className="mt-2 text-xs text-slate-400">Mock session unavailable. Try logging in again.</p>}
        </>
      )}
      {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
    </section>
  )
}
