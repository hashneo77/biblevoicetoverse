import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, get, onValue } from 'firebase/database'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions, OWNER_EMAIL, emailKey, sessionForEmail } from './firebase'
import { LoginPage } from './components/LoginPage'
import { MainApp } from './components/MainApp'
import { getTheme, nextThemeId } from './themes'

// The owner can join any user's session; their pick is remembered on this device.
const OWNER_SESSION_KEY = 'bv_owner_session'
function ownerSession() {
  try { return localStorage.getItem(OWNER_SESSION_KEY) || 'remote' } catch { return 'remote' }
}
function rememberOwnerSession(session) {
  try { localStorage.setItem(OWNER_SESSION_KEY, session) } catch { /* private mode */ }
}

// Google sign-in; access for the owner + emails listed under config/access.
// Each user has a private session, shared by their display and remote.
async function syncClaims(user) {
  try {
    await httpsCallable(functions, 'syncAccess')()
    await user.getIdToken(true)
  } catch { /* Storage (song lyrics) may refuse until next sign-in; the database still works */ }
}

async function resolveAccess(user) {
  const access = await checkAccess(user)
  if (access.status === 'allowed') await syncClaims(user)
  return access
}

async function checkAccess(user) {
  if (!user) return { status: 'signedOut' }
  const email = (user.email || '').toLowerCase()
  if (!user.emailVerified) return { status: 'denied', email }
  if (email === OWNER_EMAIL) return { status: 'allowed', email, session: ownerSession(), isOwner: true }
  try {
    const snap = await get(ref(db, `config/access/${emailKey(email)}`))
    return snap.exists() ? { status: 'allowed', email, session: sessionForEmail(email) } : { status: 'denied', email }
  } catch {
    return { status: 'denied', email }
  }
}

export default function App() {
  const [access, setAccess] = useState({ status: 'checking' })
  const [theme, setTheme] = useState(() => localStorage.getItem('bv_theme') || 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', getTheme(theme).dark)
    localStorage.setItem('bv_theme', theme)
  }, [theme])

  useEffect(() => onAuthStateChanged(auth, async user => setAccess(await resolveAccess(user))), [])

  // Owner: every user's session, to join from the header
  const [sessions, setSessions] = useState(null)
  useEffect(() => {
    if (!access.isOwner) { setSessions(null); return }
    return onValue(ref(db, 'config/access'), snap => {
      const others = Object.values(snap.val() || {}).map(u => ({ session: sessionForEmail(u.email), label: u.email }))
      setSessions([{ session: sessionForEmail(OWNER_EMAIL), label: `My screen (${OWNER_EMAIL})` }, ...others])
    })
  }, [access.isOwner])
  const switchSession = (session) => { rememberOwnerSession(session); setAccess(a => ({ ...a, session })) }

  if (access.status !== 'allowed') return <LoginPage access={access} />

  return (
    <MainApp
      key={access.session}
      sessionPrefix={access.session}
      userEmail={access.email}
      onSignOut={() => signOut(auth)}
      sessions={sessions}
      onSwitchSession={access.isOwner ? switchSession : null}
      isDark={getTheme(theme).dark}
      theme={getTheme(theme)}
      onToggleTheme={() => setTheme(t => nextThemeId(t))}
      onSetTheme={id => setTheme(getTheme(id).id)}
    />
  )
}
