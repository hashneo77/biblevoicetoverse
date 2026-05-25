import { useState, useEffect } from 'react'
import { LoginPage } from './components/LoginPage'
import { MainApp } from './components/MainApp'

const AUTH_KEY = 'bv_auth'

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(AUTH_KEY))
  const [theme, setTheme] = useState(() => localStorage.getItem('bv_theme') || 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('bv_theme', theme)
  }, [theme])

  const handleAuth = () => {
    localStorage.setItem(AUTH_KEY, '1')
    setAuthed(true)
  }

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_KEY)
    setAuthed(false)
  }

  if (!authed) return <LoginPage onAuth={handleAuth} />

  return (
    <MainApp
      isDark={theme === 'dark'}
      onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      onSetTheme={isDark => setTheme(isDark ? 'dark' : 'light')}
      onSignOut={handleSignOut}
    />
  )
}
