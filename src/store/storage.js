const DB_NAME = 'zerotrace-workbench'
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
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, 'readonly')
    const store = t.objectStore(STORE_NAME)
    const keysReq = store.getAllKeys()
    const valsReq = store.getAll()
    t.oncomplete = () => {
      const out = []
      for (let i = 0; i < keysReq.result.length; i++) {
        const rec = valsReq.result[i]
        if (rec && typeof rec === 'object') {
          out.push({ key: keysReq.result[i], record: rec })
        }
      }
      resolve(out)
    }
    t.onerror = () => reject(t.error)
  })
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
