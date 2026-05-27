'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getUser, getToken, logout } from '@/lib/supabase'
import Link from 'next/link'

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [berichte, setBerichte] = useState<any[]>([])
  const [teamBerichte, setTeamBerichte] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    if (!user) { router.push('/login'); return }

    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(data => {
      const prof = data?.[0]
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      dbQuery('berichte', `user_id=eq.${user.id}&select=*&order=updated_at.desc&limit=10`).then(d => setBerichte(d || []))

      if (prof.is_admin) {
        dbQuery('berichte', `user_id=neq.${user.id}&select=*,profiles(name)&order=updated_at.desc&limit=20`).then(d => setTeamBerichte(d || []))
      } else {
        dbQuery('profiles', `betreuer_id=eq.${user.id}&select=id`).then(teamMembers => {
          if (teamMembers?.length > 0) {
            const ids = teamMembers.map((m: any) => m.id).join(',')
            dbQuery('berichte', `user_id=in.(${ids})&select=*,profiles(name)&order=updated_at.desc&limit=20`).then(d => setTeamBerichte(d || []))
          }
        })
      }
    })
  }, [router])

  function handleLogout() { logout(); router.push('/login') }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gray-800">📊 Ziel & Ergebnis</h1>
        <div className="flex items-center gap-3">
          {profile.is_admin && <Link href="/admin" className="text-sm text-blue-600 font-medium">Admin</Link>}
          <Link href="/analytics" className="text-sm text-blue-600 font-medium">Analytics</Link>
          <span className="text-sm text-gray-500">{profile.name}</span>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">Abmelden</button>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Willkommen, {profile.name.split(' ')[0]}!</h2>
            <p className="text-gray-500 text-sm">Karrierestufe {profile.karrierestufe}</p>
          </div>
          <Link href="/bericht" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">+ Neuer Wochenbericht</Link>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-3">Meine Berichte</h3>
          {berichte.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Berichte vorhanden.</p> : (
            <div className="space-y-2">
              {berichte.map(b => (
                <Link key={b.id} href={`/bericht?id=${b.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition">
                  <span className="text-sm font-medium text-gray-700">{b.monat} / {b.woche} {b.jahr}</span>
                  <span className="text-xs text-gray-400">{new Date(b.updated_at).toLocaleDateString('de-AT')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        {teamBerichte.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Team-Berichte</h3>
            <div className="space-y-2">
              {teamBerichte.map(b => (
                <Link key={b.id} href={`/bericht?id=${b.id}&readonly=1`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition">
                  <div>
                    <span className="text-sm font-medium text-gray-700">{b.profiles?.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{b.monat} / {b.woche} {b.jahr}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(b.updated_at).toLocaleDateString('de-AT')}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
