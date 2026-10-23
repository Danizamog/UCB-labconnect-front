import PocketBase from 'pocketbase'

let _instance = null

export function getPocketBaseClient() {
  if (!_instance) {
    const url = (import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090').replace(/\/$/, '')
    _instance = new PocketBase(url)
    _instance.autoCancellation(false)
  }
  return _instance
}
