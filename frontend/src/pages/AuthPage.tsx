import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { ServiceError } from '../services/DevAtlasService'
import { isLive } from '../services/serviceMode'
import { MAX_DISPLAY_NAME_LENGTH, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, validateAuth } from '../services/authValidation'
import type { AuthErrors, AuthField } from '../services/authValidation'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup'
  const auth = useAuth()
  const location = useLocation()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<AuthErrors>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [working, setWorking] = useState(false)
  const submitting = useRef(false)
  const mounted = useRef(true)
  const fields = useRef<Partial<Record<AuthField, HTMLInputElement | null>>>({})
  const errorRef = useRef<HTMLParagraphElement>(null)
  const successRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function clearError(field: AuthField) {
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setError('')
  }

  async function authenticate(demo = false) {
    if (submitting.current || auth.pending || auth.initializing) return
    const invalid = demo ? {} : validateAuth({ displayName, email, password }, mode)
    if (!demo && signup && confirmPassword !== password) invalid.confirmPassword = 'Passwords must match.'
    if (!demo && signup && !confirmPassword) invalid.confirmPassword = 'Repeat your password.'
    setErrors(invalid)
    setError('')
    const order: AuthField[] = signup ? ['displayName', 'email', 'password', 'confirmPassword'] : ['email', 'password']
    const first = order.find((field) => invalid[field])
    if (first) { fields.current[first]?.focus(); return }
    submitting.current = true
    setWorking(true)
    try {
      if (demo) await auth.logInDemo()
      else if (signup) await auth.signUp({ displayName, email, password })
      else await auth.logIn({ email, password })
      if (!mounted.current) return
      setPassword('')
      setConfirmPassword('')
      setSuccess(true)
      requestAnimationFrame(() => successRef.current?.focus())
    } catch (reason) {
      if (!mounted.current) return
      setPassword('')
      setConfirmPassword('')
      const message = reason instanceof ServiceError && reason.code === 'INVALID_CREDENTIALS'
        ? 'Email or password is incorrect. Please try again.'
        : reason instanceof ServiceError && reason.code === 'EMAIL_IN_USE'
          ? 'An account already uses this email. Try logging in.'
          : isLive ? 'Authentication is unavailable. Check the server and try again.' : 'Mock authentication is unavailable. Please try again.'
      setError(message)
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      submitting.current = false
      if (mounted.current) setWorking(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void authenticate()
  }
  const disabled = working || auth.pending || auth.initializing

  return (
    <section className="mx-auto max-w-xl px-6 py-10 md:py-16">
      <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-indigo-400">Your learning journey</p>
      <Card aria-labelledby="auth-title">
        <h1 id="auth-title" className="text-3xl font-bold">{auth.session ? 'You’re signed in' : signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{isLive ? 'Your account and progress are securely saved on the server.' : 'Mock authentication for this prototype. Accounts and sessions reset on reload. Use a test password you do not use elsewhere.'}</p>

        {auth.session ? (
          <>
            <p ref={successRef} tabIndex={-1} role="status" className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-200">
              {success && signup ? isLive ? 'Account created. ' : 'Mock account created. ' : ''}Signed in as {auth.session.user.displayName}.
            </p>
            <Link to="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-700">Continue to Dashboard</Link>
          </>
        ) : (
          <>
            {location.state?.signedOut && !working && <p role="status" className="mt-5 text-emerald-200">You are signed out.</p>}
            {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-200">{error}</p>}
            <form noValidate onSubmit={submit} aria-busy={working} className="mt-6 space-y-5">
              <fieldset disabled={disabled} className="space-y-5">
                <legend className="sr-only">{signup ? 'Sign up details' : 'Login details'}</legend>
                {signup && <Input label="Name" name="displayName" autoComplete="name" required maxLength={MAX_DISPLAY_NAME_LENGTH} value={displayName} error={errors.displayName} ref={(element) => { fields.current.displayName = element }} onChange={(event) => { setDisplayName(event.target.value); clearError('displayName') }} />}
                <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} error={errors.email} ref={(element) => { fields.current.email = element }} onChange={(event) => { setEmail(event.target.value); clearError('email') }} />
                <Input label="Password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} hint={`Use ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`} value={password} error={errors.password} ref={(element) => { fields.current.password = element }} onChange={(event) => { setPassword(event.target.value); clearError('password') }} />
                {signup && <Input label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={MAX_PASSWORD_LENGTH} value={confirmPassword} error={errors.confirmPassword} ref={(element) => { fields.current.confirmPassword = element }} onChange={(event) => { setConfirmPassword(event.target.value); clearError('confirmPassword') }} />}
                <Button type="submit" disabled={disabled} className="w-full">{working ? 'Please wait…' : signup ? isLive ? 'Create account' : 'Create mock account' : 'Log in'}</Button>
                {!isLive && !signup && <Button variant="ghost" disabled={disabled} className="w-full" onClick={() => { void authenticate(true) }}>Try mock demo account</Button>}
              </fieldset>
              {working && <p role="status" className="text-sm text-indigo-200">{signup ? isLive ? 'Creating your account…' : 'Creating your mock account…' : 'Signing in…'}</p>}
            </form>
            <p className="mt-6 text-sm text-slate-400">{signup ? isLive ? 'Already have an account? ' : 'Already have a mock account? ' : 'New to DevAtlas? '}<Link className="font-semibold text-indigo-300 hover:underline" to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Sign up'}</Link></p>
          </>
        )}
      </Card>
    </section>
  )
}
