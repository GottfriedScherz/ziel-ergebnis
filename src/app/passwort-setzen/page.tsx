'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'

function PasswortSetzenContent() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Supabase puts tokens in the URL hash: #access_token=xxx&type=recovery
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const type = params.get('type')
    
    console.log('Hash:', hash)
    console.log('Access token:', accessToken)
    console.log('Type:', type)

    if (accessToken) {
      setToken(accessToken)
    } else {
      // Also check query string
      const queryParams = new URLSearchParams(window.location.search)
      const queryToken = queryParams.get('access_token') || queryParams.get('token')
      if (queryToken) setToken(queryToken)
    }
    setChecking(false)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwörter stimmen nicht überein.'); return }
    if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen haben.'); return }
    if (!token) { setError('Kein gültiger Token. Bitte den Link aus der E-Mail erneut öffnen.'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: password, accessToken: token })
    })

    const data = await res.json()
    setLoading(false)

    if (data.error) {
      setError(data.error)
    } else {
      localStorage.setItem('sb_access_token', token)
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  if (checking) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>
  )

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Link ungültig</h1>
        <p className="text-gray-500 text-sm mb-4">Der Link ist abgelaufen oder ungültig. Bitte deinen Betreuer um eine neue Einladung.</p>
        <button onClick={() => router.push('/login')}
          className="bg-blue-600 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-blue-700 transition">
          Zum Login
        </button>
      </div>
    </div>
  )

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Passwort gesetzt!</h1>
        <p className="text-gray-500 text-sm">Du wirst zum Dashboard weitergeleitet...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">📊 Ziel & Ergebnis</h1>
          <p className="text-gray-500 text-sm mt-1">Persönliches Passwort setzen</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Neues Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              autoComplete="new-password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mindestens 6 Zeichen" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Passwort bestätigen</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              autoComplete="new-password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Passwort wiederholen" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {loading ? 'Wird gespeichert...' : 'Passwort setzen & anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PasswortSetzen() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>}><PasswortSetzenContent /></Suspense>
}
