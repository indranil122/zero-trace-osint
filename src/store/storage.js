const DB_NAME = 'veiltrace-workbench'
const LEGACY_DB_NAME = 'zerotrace-workbench'
const STORE_NAME = 'cases'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveCase(id, data) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite')
    t.objectStore(STORE_NAME).put(data, id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function loadCase(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly')
    const req = t.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function loadAllCases() {
  const db = await openDb()
  const primary = await new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly')
    const store = t.objectStore(STORE_NAME)
    const keysReq = store.getAllKeys()
    const valsReq = store.getAll()
    t.oncomplete = () => {
      const out = []
      for (let i = 0; i < keysReq.result.length; i++) {
        const rec = valsReq.result[i]
        if (rec && typeof rec === 'object') out.push({ key: keysReq.result[i], record: rec })
      }
      resolve(out)
    }
    t.onerror = () => reject(t.error)
  })
  if (primary.length) return primary
  // legacy migration: read from zerotrace-workbench if new store is empty
  try {
    const legacyReq = indexedDB.open(LEGACY_DB_NAME, DB_VERSION)
    const legacyDb = await new Promise((res, rej) => {
      legacyReq.onsuccess = () => res(legacyReq.result)
      legacyReq.onerror = () => rej(legacyReq.error)
      legacyReq.onupgradeneeded = () => res(legacyReq.result)
    })
    if (!legacyDb.objectStoreNames.contains(STORE_NAME)) return primary
    const out = await new Promise((resolve, reject) => {
      const t = legacyDb.transaction(STORE_NAME, 'readonly')
      const store = t.objectStore(STORE_NAME)
      const keysReq = store.getAllKeys()
      const valsReq = store.getAll()
      t.oncomplete = () => {
        const arr = []
        for (let i = 0; i < keysReq.result.length; i++) {
          const rec = valsReq.result[i]
          if (rec && typeof rec === 'object') arr.push({ key: keysReq.result[i], record: rec })
        }
        resolve(arr)
      }
      t.onerror = () => reject(t.error)
    })
    // copy legacy into new DB for next load
    for (const { key, record } of out) {
      try { await saveCase(key, record) } catch {}
    }
    return out.length ? out : primary
  } catch { return primary }
}

export async function deleteStoredCase(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readwrite')
    t.objectStore(STORE_NAME).delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}
