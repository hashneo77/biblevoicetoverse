import { useState, useRef, useEffect } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../firebase'

const PIN_LENGTH = 6

// Same mapping as the remote app. Key = PIN, value = Firebase path prefix.
const SESSIONS_FALLBACK = { '123456': 'remote', '654321': 'session2' }

export function LoginPage({ onAuth }) {
  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  async function verifyPin(pin) {
    setLoading(true)
    setError('')
    try {
      let sessions = SESSIONS_FALLBACK
      try {
        const snap = await get(ref(db, 'config/sessions'))
        if (snap.val()) sessions = snap.val()
      } catch { /* use hardcoded fallback */ }
      const sessionPrefix = sessions[pin]
      if (sessionPrefix) {
        onAuth(sessionPrefix)
      } else {
        triggerError('Incorrect PIN')
      }
    } finally {
      setLoading(false)
    }
  }

  function triggerError(msg) {
    setShake(true)
    setError(msg)
    setDigits(Array(PIN_LENGTH).fill(''))
    setTimeout(() => {
      setShake(false)
      inputRefs.current[0]?.focus()
    }, 500)
  }

  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = val
    setDigits(next)
    setError('')

    if (val && i < PIN_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus()
    }

    if (val && next.every(d => d !== '')) {
      verifyPin(next.join(''))
    }
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]
        next[i] = ''
        setDigits(next)
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus()
        const next = [...digits]
        next[i - 1] = ''
        setDigits(next)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < PIN_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus()
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!pasted) return
    e.preventDefault()
    const next = Array(PIN_LENGTH).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
    if (pasted.length === PIN_LENGTH) verifyPin(pasted)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-12 text-center shadow-2xl ${shake ? 'animate-shake' : ''}`}>

          {/* Logo */}
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-center bg-contain bg-no-repeat shadow-lg"
            style={{ backgroundImage: 'url(/icons/icon-192.png)' }}
          />

          <h1 className="font-verse text-4xl font-semibold text-amber-300 mb-2 tracking-tight">
            Bible Voice
          </h1>
          <p className="text-slate-400 text-sm mb-10">Enter your 6-digit PIN</p>

          {/* PIN inputs */}
          <div className="flex justify-center gap-2.5 mb-6" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
                className={`
                  w-11 h-14 text-center text-2xl font-bold rounded-xl border-2
                  bg-white/[0.06] outline-none transition-all duration-150 caret-transparent
                  disabled:opacity-50
                  ${d ? 'text-amber-300 border-amber-400/60 bg-amber-400/10' : 'text-slate-300 border-slate-700'}
                  focus:border-amber-400 focus:bg-amber-400/[0.08]
                `}
              />
            ))}
          </div>

          {/* Status */}
          <div className="h-5">
            {loading && (
              <div className="flex justify-center">
                <span className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
              </div>
            )}
            {error && !loading && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          v1.0.0 · Bible Voice to Verse
        </p>
      </div>
    </div>
  )
}
