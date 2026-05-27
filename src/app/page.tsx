'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    if (getToken()) router.push('/dashboard')
    else router.push('/login')
  }, [router])
  return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-400">Laden...</div></div>
}
