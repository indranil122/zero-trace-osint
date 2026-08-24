const SALT_KEY = 'veiltrace-lock-salt'
const HASH_KEY = 'veiltrace-lock-hash'
const ITERATIONS = 250000

function b64encode(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function b64decode(str) {
  const bin = atob(str)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveBits(password, saltBytes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' }, base, 256)
  return new Uint8Array(bits)
}

export function hasLock() {
  try {
    return Boolean(localStorage.getItem(HASH_KEY) && localStorage.getItem(SALT_KEY))
  } catch { return false }
}

export async function createLock(password) {
  const pw = String(password || '')
  if (pw.length < 8) throw new Error('Password must be at least 8 characters')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(pw, salt)
  try {
    localStorage.setItem(SALT_KEY, b64encode(salt))
    localStorage.setItem(HASH_KEY, b64encode(hash))
  } catch (e) { throw new Error('Storage unavailable: ' + e.message) }
}

export async function verifyLock(password) {
  const pw = String(password || '')
  let saltB64, expectedB64
  try {
    saltB64 = localStorage.getItem(SALT_KEY)
    expectedB64 = localStorage.getItem(HASH_KEY)
  } catch { return false }
  if (!saltB64 || !expectedB64) return false
  const salt = b64decode(saltB64)
  const expected = b64decode(expectedB64)
  const derived = await deriveBits(pw, salt)
  if (derived.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i]
  return diff === 0
}

export function clearLock() {
  try {
    localStorage.removeItem(SALT_KEY)
    localStorage.removeItem(HASH_KEY)
  } catch {}
}

export async function changeLock(currentPassword, newPassword) {
  const ok = await verifyLock(currentPassword)
  if (!ok) throw new Error('Current password is incorrect')
  if (String(newPassword || '').length < 8) throw new Error('New password must be at least 8 characters')
  // create new lock overwrites old
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(String(newPassword), salt)
  try {
    localStorage.setItem(SALT_KEY, b64encode(salt))
    localStorage.setItem(HASH_KEY, b64encode(hash))
  } catch (e) { throw new Error('Storage unavailable: ' + e.message) }
}
