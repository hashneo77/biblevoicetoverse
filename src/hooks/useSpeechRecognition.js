import { useRef, useState, useCallback, useEffect } from 'react'

export function useSpeechRecognition({ onResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recogRef = useRef(null)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  useEffect(() => { onResultRef.current = onResult }, [onResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const supported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const start = useCallback(() => {
    if (!supported || recogRef.current) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = true
    r.continuous = true
    r.maxAlternatives = 1

    r.onresult = ev => {
      let interim = ''
      let final = ''
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        const res = ev.results[i]
        if (res.isFinal) final += res[0].transcript + ' '
        else interim += res[0].transcript + ' '
      }
      const parts = []
      if (interim) parts.push('Interim: ' + interim.trim())
      if (final) parts.push('Final: ' + final.trim())
      setTranscript(parts.join('\n'))
      const stable = final.trim()
      if (stable) onResultRef.current?.(stable)
    }

    r.onend = () => {
      setIsListening(false)
      setTranscript('')
      recogRef.current = null
    }

    r.onerror = e => {
      setIsListening(false)
      setTranscript('')
      recogRef.current = null
      onErrorRef.current?.(e.error || 'Speech recognition error')
    }

    recogRef.current = r
    try {
      r.start()
      setIsListening(true)
    } catch {
      recogRef.current = null
    }
  }, [supported])

  const stop = useCallback(() => {
    recogRef.current?.stop()
    recogRef.current = null
    setIsListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (isListening) stop()
    else start()
  }, [isListening, start, stop])

  return { isListening, transcript, toggle, supported }
}
