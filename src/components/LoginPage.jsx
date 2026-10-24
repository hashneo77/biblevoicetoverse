import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { auth } from '../firebase'

// Sign-in screen: Google account; only the owner + emails they've allowed get in.
export function LoginPage({ access }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn() {
    setError('')
    setBusy(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      await signInWithPopup(auth, provider)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(e.message || 'Sign-in failed')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-12 text-center shadow-2xl">

          {/* Logo */}
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-center bg-contain bg-no-repeat shadow-lg"
            style={{ backgroundImage: 'url(/icons/icon-192.png)' }}
          />

          <h1 className="font-verse text-4xl font-semibold text-amber-300 mb-2 tracking-tight">
            Bible Voice
          </h1>

          {access.status === 'checking' ? (
            <div className="flex justify-center mt-10">
              <span className="w-5 h-5 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
            </div>
          ) : access.status === 'denied' ? (
            <>
              <p className="text-slate-400 text-sm mb-6">
                {access.email || 'This account'} doesn't have access.
                <br />Ask the owner to add it.
              </p>
              <button
                onClick={() => signOut(auth)}
                className="w-full rounded-xl border border-slate-700 px-4 py-3 text-slate-200 hover:bg-white/10 transition"
              >
                Use a different account
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-sm mb-8">Sign in to continue</p>
              <button
                onClick={handleSignIn}
                disabled={busy}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-50 transition"
              >
                {busy ? 'Signing in…' : 'Sign in with Google'}
              </button>
            </>
          )}

          <div className="min-h-5 mt-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          v1.0.0 · Bible Voice to Verse
        </p>
      </div>
    </div>
  )
}
