import { md5 } from '../utils/md5'

export function gravatarProbe(email) {
  const clean = String(email || '').trim().toLowerCase()
  return new Promise((resolve) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      resolve({ found: false, error: 'invalid email' })
      return
    }
    const hash = md5(clean)
    const avatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=200`
    const profileUrl = `https://gravatar.com/${hash}`
    const img = new Image()
    let settled = false
    const done = (found) => {
      if (settled) return
      settled = true
      resolve({ found, hash, avatarUrl, profileUrl })
    }
    img.onload = () => done(true)
    img.onerror = () => done(false)
    setTimeout(() => done(false), 8000)
    img.src = avatarUrl
  })
}
