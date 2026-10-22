export const FOCUSED_TUTORIAL_KEY = 'labconnect.focus_tutorial_session_id'
export const OPEN_TUTORIAL_EVENT = 'labconnect:open-tutorial-session'
export const TUTORIALS_PATH = '/app/tutorias'

export function openTutorialSessionFlow(sessionId, { navigate = false } = {}) {
  const normalizedId = String(sessionId || '').trim()
  if (!normalizedId || typeof window === 'undefined') {
    return
  }

  localStorage.setItem(FOCUSED_TUTORIAL_KEY, normalizedId)
  window.dispatchEvent(new CustomEvent(OPEN_TUTORIAL_EVENT, { detail: { sessionId: normalizedId } }))

  if (!navigate) {
    return
  }

  if (window.location.pathname !== TUTORIALS_PATH) {
    window.history.pushState({}, '', TUTORIALS_PATH)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  window.scrollTo({ top: 0, behavior: 'smooth' })
}
