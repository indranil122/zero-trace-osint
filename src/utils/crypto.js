const PBKDF2_ITERATIONS = 250000

function b64encode(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function b64decode(str) {
  const bin = atob(str)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptToVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(data))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    format: 'ztvault',
    v: 1,
    kdf: `PBKDF2-SHA256-${PBKDF2_ITERATIONS}`,
    salt: b64encode(salt),
    iv: b64encode(iv),
    data: b64encode(cipher),
  }
}

export async function decryptFromVault(vault, password) {
  if (!vault || vault.format !== 'ztvault') throw new Error('Not a VeilTrace vault file')
  try {
    const key = await deriveKey(password, b64decode(vault.salt))
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64decode(vault.iv) },
      key,
      b64decode(vault.data)
    )
    return JSON.parse(new TextDecoder().decode(plain))
  } catch {
    throw new Error('Wrong password or corrupted vault')
  }
}
