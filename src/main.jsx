import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

let canRenderApp = true

if (typeof window !== 'undefined') {
  const isDev = Boolean(import.meta.env.DEV)
  const currentUrl = new URL(window.location.href)
  const shouldCanonicalizeLocalhost = isDev && currentUrl.hostname === '127.0.0.1'

  if (shouldCanonicalizeLocalhost) {
    currentUrl.hostname = 'localhost'
    canRenderApp = false
    window.location.replace(currentUrl.toString())
  }
}

if (canRenderApp) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa
//aaaaaaaaa
//aaaaaaaaaaa