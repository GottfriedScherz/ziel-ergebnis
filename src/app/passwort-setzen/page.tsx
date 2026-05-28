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
    const hash = window.location.hash.substring(1)
    const hashParams = new URLSearchParams(hash)
    const queryParams = new URLSearchParams(window.location.search)

    const accessToken = hashParams.get('access_token') || queryParams.get('access_token')
    const code = queryParams.get('code')

    console.log('Hash:', hash)
    console.log('Query:', window.location.search)
    console.log('Access token:', accessToken)
    console.log('Code:', code)

    if (accessToken) {
      setToken(accessToken)
    } else if (code) {
      setToken(code)
    } else {
      const queryToken = queryParams.get('token')
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
