import { useState, useEffect } from 'react'
import { LoginPage } from './components/LoginPage'
import { MainApp } from './components/MainApp'

const AUTH_KEY = 'bv_auth'
const AUTH_TS_KEY = 'bv_auth_ts'
const SESSION_PREFIX_KEY = 'bv_session_prefix'
const SESSION_MS = 10 * 60 * 60 * 1000 // 10 hours

function isSessionValid() {
  const ts = Number(localStorage.getItem(AUTH_TS_KEY) || 0)
  return !!localStorage.getItem(AUTH_KEY) && Date.now() - ts < SESSION_MS
}

export default function App() {
  const [authed, setAuthed] = useState(() => isSessionValid())
  const [sessionPrefix, setSessionPrefix] = useState(
    () => localStorage.getItem(SESSION_PREFIX_KEY) || 'remote'
  )
  const [theme, setTheme] = useState(() => localStorage.getItem('bv_theme') || 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('bv_theme', theme)
  }, [theme])

  // Auto-expire after 10 hours
  useEffect(() => {
    if (!authed) return
    const ts = Number(localStorage.getItem(AUTH_TS_KEY) || 0)
    const remaining = SESSION_MS - (Date.now() - ts)
    if (remaining <= 0) { handleSignOut(); return }
    const t = setTimeout(handleSignOut, remaining)
    return () => clearTimeout(t)
  }, [authed]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAuth = (prefix) => {
    localStorage.setItem(AUTH_KEY, '1')
    localStorage.setItem(AUTH_TS_KEY, String(Date.now()))
    localStorage.setItem(SESSION_PREFIX_KEY, prefix)
    setSessionPrefix(prefix)
    setAuthed(true)
  }

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(AUTH_TS_KEY)
    localStorage.removeItem(SESSION_PREFIX_KEY)
    setAuthed(false)
  }

  if (!authed) return <LoginPage onAuth={handleAuth} />

  return (
    <MainApp
      sessionPrefix={sessionPrefix}
      isDark={theme === 'dark'}
      onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      onSetTheme={isDark => setTheme(isDark ? 'dark' : 'light')}
    />
  )
}
