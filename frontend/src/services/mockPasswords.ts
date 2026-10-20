// In-memory mock credential hashing, not a production authentication system.
interface PasswordRecord {
  salt: Uint8Array<ArrayBuffer>
  digest: Uint8Array<ArrayBuffer>
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256)
  return new Uint8Array(bits)
}

export async function hashMockPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt, digest: await derive(password, salt) }
}

export async function matchesMockPassword(password: string, record: PasswordRecord): Promise<boolean> {
  const digest = await derive(password, record.salt)
  let difference = 0
  for (let index = 0; index < digest.length; index++) difference |= digest[index] ^ record.digest[index]
  return difference === 0
}
