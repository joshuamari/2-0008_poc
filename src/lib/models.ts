import { useEffect, useState } from 'react'
import { readGlbComponents, type GlbComponent } from './glb'

const DB_NAME = '2-0008'
const STORE = 'models'

type StoredModel = {
  fileName: string
  data: ArrayBuffer
}

export type StoredModelState = {
  url: string | null
  components: GlbComponent[]
  error: string | null
  loading: boolean
}

const emptyState: StoredModelState = { url: null, components: [], error: null, loading: false }

export function useStoredModel(id: string, fileName: string): StoredModelState {
  const [state, setState] = useState<StoredModelState>(() => ({
    ...emptyState,
    loading: Boolean(fileName),
  }))

  useEffect(() => {
    if (!fileName) {
      setState(emptyState)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    setState({ url: null, components: [], error: null, loading: true })

    loadModel(id)
      .then((stored) => {
        if (cancelled) return
        if (!stored) {
          setState({
            url: null,
            components: [],
            error: 'The GLB saved with this assembly is not in this browser. Edit the assembly and upload it again.',
            loading: false,
          })
          return
        }
        const data = asArrayBuffer(stored.data)
        if (!data) {
          setState({ url: null, components: [], error: 'The saved GLB could not be read.', loading: false })
          return
        }
        let components: GlbComponent[] = []
        try {
          components = readGlbComponents(data)
        } catch (error) {
          setState({
            url: null,
            components: [],
            error: error instanceof Error ? error.message : 'The saved GLB could not be read.',
            loading: false,
          })
          return
        }
        objectUrl = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }))
        setState({ url: objectUrl, components, error: null, loading: false })
      })
      .catch(() => {
        if (!cancelled) {
          setState({ url: null, components: [], error: 'The saved GLB could not be opened.', loading: false })
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, fileName])

  return state
}

export async function saveModel(id: string, file: File): Promise<void> {
  const data = await file.arrayBuffer()
  const db = await openDb()
  try {
    await run(db, 'readwrite', (store) => store.put({ fileName: file.name, data } satisfies StoredModel, id))
  } finally {
    db.close()
  }
}

export async function deleteModel(id: string): Promise<void> {
  const db = await openDb()
  try {
    await run(db, 'readwrite', (store) => store.delete(id))
  } finally {
    db.close()
  }
}

async function loadModel(id: string): Promise<StoredModel | null> {
  const db = await openDb()
  try {
    const result = await run<StoredModel | undefined>(db, 'readonly', (store) => store.get(id))
    return result ?? null
  } finally {
    db.close()
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.onerror = () => reject(tx.error)
  })
}

function asArrayBuffer(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  }
  return null
}
