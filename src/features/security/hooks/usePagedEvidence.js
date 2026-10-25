import { useEffect, useRef, useState } from 'react'

/** Mantiene la ultima pagina visible y descarta respuestas de consultas anteriores. */
export default function usePagedEvidence(fetchPage, { enabled = true, refreshKey = 0, initialFilters = {} } = {}) {
  const [filters, setFilters] = useState({ page: 1, per_page: 20, query: '', status: '', action: '', date_from: '', date_to: '', ...initialFilters })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loadedRequest, setLoadedRequest] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [lastSuccess, setLastSuccess] = useState(null)
  const snapshot = useRef(null)
  const refresh = useRef(refreshKey)
  const loadedKey = useRef('')
  const requestKey = JSON.stringify([filters, refreshKey, attempt])
  useEffect(() => {
    if (!enabled || loadedKey.current === requestKey) return undefined
    if (refresh.current !== refreshKey) { snapshot.current = null; refresh.current = refreshKey }
    const controller = new AbortController()
    let active = true
    const timer = window.setTimeout(async () => {
      setError('')
      try {
        const result = await fetchPage({ ...filters, snapshot_at: snapshot.current || '' }, { signal: controller.signal })
        if (!active) return
        if (!Array.isArray(result?.items) || !Number.isFinite(result?.totalItems) || !Number.isFinite(result?.totalPages)) {
          throw new Error('El servidor no devolvió una página válida. Comprueba que el backend esté actualizado.')
        }
        snapshot.current = result.snapshotAt || snapshot.current
        if (result.totalPages > 0 && filters.page > result.totalPages) {
          setFilters((current) => ({ ...current, page: result.totalPages }))
          return
        }
        loadedKey.current = requestKey
        setLoadedRequest(requestKey)
        setData(result); setLastSuccess(new Date().toISOString())
      } catch (err) {
        if (active && err.name !== 'AbortError') setError(err.message || 'No se pudo actualizar la consulta.')
      }
    }, 250)
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [enabled, fetchPage, filters, refreshKey, requestKey])

  const update = (key, value) => {
    setError('')
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }))
  }
  const retry = () => { setError(''); setAttempt((value) => value + 1) }
  return { filters, data, error, lastSuccess, update, retry,
    loading: !error && loadedRequest !== requestKey, hasData: data !== null }
}
