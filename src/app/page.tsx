'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const type = params.get('type')

    if (accessToken && (type === 'invite' || type === 'recovery')) {
      router.push(`/passwort-setzen${window.location.hash}`)
    } else if (getToken()) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Laden...</div></div>
}
