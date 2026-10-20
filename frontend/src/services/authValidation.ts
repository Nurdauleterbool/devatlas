export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
export const MAX_DISPLAY_NAME_LENGTH = 80

export type AuthField = 'displayName' | 'email' | 'password' | 'confirmPassword'
export type AuthErrors = Partial<Record<AuthField, string>>

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function validEmailSyntax(email: string): boolean {
  if (email.length > 254) return false
  const [local, domain, extra] = email.split('@')
  if (!local || !domain || extra !== undefined || local.length > 64) return false
  if (/^[.]/.test(local) || /[.]$/.test(local) || local.includes('..') || /[\s<>(),;:"\\]/.test(local)) return false
  const labels = domain.split('.')
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
}

/** Practical form syntax validation, shared by the UI and mock boundary. */
export function validateAuth(input: unknown, mode: 'login' | 'signup'): AuthErrors {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const errors: AuthErrors = {}
  const email = typeof data.email === 'string' ? normalizeEmail(data.email) : ''
  if (!email) errors.email = 'Enter your email address.'
  else if (!validEmailSyntax(email)) {
    errors.email = 'Enter a valid email address, such as name@example.com.'
  }
  const password = typeof data.password === 'string' ? data.password : ''
  if (!password.trim()) errors.password = 'Enter your password.'
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  else if (password.length > MAX_PASSWORD_LENGTH) errors.password = `Use no more than ${MAX_PASSWORD_LENGTH} characters.`
  if (mode === 'signup') {
    const name = typeof data.displayName === 'string' ? data.displayName.trim() : ''
    if (!name) errors.displayName = 'Enter your name.'
    else if (name.length > MAX_DISPLAY_NAME_LENGTH) errors.displayName = `Use no more than ${MAX_DISPLAY_NAME_LENGTH} characters for your name.`
  }
  return errors
}
