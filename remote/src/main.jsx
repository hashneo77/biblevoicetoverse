import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// After a new version is deployed, a page that was already open still asks for the old file names.
// When one of those lazy-loaded files is gone, load the new version once (not in a loop).
function reloadForNewVersion() {
  try {
    if (sessionStorage.getItem('bv_reloaded_for_update')) return false
    sessionStorage.setItem('bv_reloaded_for_update', '1')
  } catch { return false }
  window.location.reload()
  return true
}
window.addEventListener('vite:preloadError', (e) => { if (reloadForNewVersion()) e.preventDefault() })
window.addEventListener('load', () => setTimeout(() => { try { sessionStorage.removeItem('bv_reloaded_for_update') } catch { /* private mode */ } }, 10000))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
