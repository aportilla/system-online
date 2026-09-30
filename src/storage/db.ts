// Library storage: a promise wrapper over IndexedDB. Database `system-online`,
// object stores keyed by `id`:
//
// - `folders`: `{id, name, parent, createdAt, modifiedAt}`.
// - `texts`: `{id, name, folder, createdAt, modifiedAt}` with either `text` or
//   `builtin`, the key of a text the app ships.
// - `fonts`: `{id, name, folder, createdAt, modifiedAt, family}`.
//
// The schema is STORES, with no fixed version number. The database opens at the
// profile's current version. If a store is missing, it reopens one version up
// and the upgrade handler creates it. Opening at a fixed version throws
// VersionError on a profile that is already higher.
//
// Every method rejects on IndexedDB failure, and the files slice then reports
// available: false. A blocked open waits for the other tab to close its
// connection. Each connection closes itself on versionchange, and the next call
// reopens.

import type { LibraryStorage } from '../state/files.ts'

const DB_NAME = 'system-online'
const FOLDERS = 'folders'
const TEXTS = 'texts'
const FONTS = 'fonts'
/** Every store the app needs. */
const STORES = [FOLDERS, TEXTS, FONTS]

const reqToPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'))
  })

/** The stores a connection lacks. */
const missingStores = (db: IDBDatabase) => STORES.filter((s) => !db.objectStoreNames.contains(s))

/** Opens the database at `version`, or at the profile's own version when
 *  undefined. The upgrade handler creates any missing store. */
function openAt(version: number | undefined, onVersionChange: () => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version == null ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of missingStores(db)) db.createObjectStore(s, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => {
        onVersionChange()
        db.close()
      }
      resolve(db)
    }
    req.onerror = () => {
      const err = req.error || new Error('IndexedDB open failed')
      console.warn('SystemOnline: IndexedDB open failed —', err)
      reject(err)
    }
    // Another connection holds the old version. The request completes once it
    // closes.
    req.onblocked = () => {
      console.warn(
        'SystemOnline: waiting for another tab to let go of the old database schema — close or reload it'
      )
    }
  })
}

/** Opens the database, reopening one version up if a store is missing. */
async function openDb(onVersionChange: () => void): Promise<IDBDatabase> {
  let db = await openAt(undefined, onVersionChange)
  if (missingStores(db).length) {
    const next = db.version + 1
    db.close()
    db = await openAt(next, onVersionChange)
  }
  return db
}

/** The storage the files slice consumes. The database opens on first use, and
 *  a failed open is retried on the next call. */
export function createLibraryStorage(): LibraryStorage {
  let dbPromise: Promise<IDBDatabase> | null = null
  const db = () => {
    dbPromise ??= openDb(() => {
      dbPromise = null // reopen on the next call
    }).catch((err) => {
      dbPromise = null // retry on the next call
      throw err
    })
    return dbPromise
  }

  const run = async <T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> => {
    const store = (await db()).transaction(storeName, mode).objectStore(storeName)
    return reqToPromise(fn(store))
  }

  return {
    listFolders: () => run(FOLDERS, 'readonly', (s) => s.getAll()),
    putFolder: (record) => run(FOLDERS, 'readwrite', (s) => s.put(record)),
    removeFolder: (id) => run(FOLDERS, 'readwrite', (s) => s.delete(id)),
    listTexts: () => run(TEXTS, 'readonly', (s) => s.getAll()),
    getText: (id) => run(TEXTS, 'readonly', (s) => s.get(id)),
    putText: (record) => run(TEXTS, 'readwrite', (s) => s.put(record)),
    removeText: (id) => run(TEXTS, 'readwrite', (s) => s.delete(id)),
    listFonts: () => run(FONTS, 'readonly', (s) => s.getAll()),
    getFont: (id) => run(FONTS, 'readonly', (s) => s.get(id)),
    putFont: (record) => run(FONTS, 'readwrite', (s) => s.put(record)),
    removeFont: (id) => run(FONTS, 'readwrite', (s) => s.delete(id)),
  }
}

/** The IndexedDB storage, or null where IndexedDB is undefined. A broken
 *  IndexedDB (private modes) rejects per call instead. */
export function createStorageIfAvailable(): LibraryStorage | null {
  try {
    return typeof indexedDB === 'undefined' ? null : createLibraryStorage()
  } catch {
    return null
  }
}
