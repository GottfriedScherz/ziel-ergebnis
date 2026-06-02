'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, dbDelete, getUser, getToken, logout } from '@/lib/supabase'
import Link from 'next/link'

function UserAvatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  if (url) return <img src={url} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} className="border-2 border-gray-200" />
  return <div style={{width:size,height:size,borderRadius:'50%',fontSize:size*0.35}} className="bg-blue-100 text-blue-700 flex items-center justify-center font-semibold border-2 border-gray-200">{initials}</div>
}

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [berichte, setBerichte] = useState<any[]>([])
  const [vmBerichte, setVmBerichte] = useState<any[]>([])
  const [teamBerichte, setTeamBerichte] = useState<any[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    if (!user) { router.push('/login'); return }

    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(async prof => {
      const p = prof?.[0]
      if (!p) { router.push('/login'); return }
      setProfile(p)
      setAvatarUrl(p.avatar_url || null)

      // Eigene Berichte
      dbQuery('berichte', `user_id=eq.${user.id}&select=*&order=updated_at.desc&limit=10`).then(d => setBerichte(d || []))

      // Eigene VM-Berichte
      dbQuery('vm_berichte', `user_id=eq.${user.id}&select=*&order=updated_at.desc&limit=10`).then(d => setVmBerichte(d || []))

      // Team-Berichte
      if (p.is_admin) {
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

  async function handleDelete(id: string, label: string, type: 'own' | 'vm' | 'team') {
    if (!confirm(`Bericht "${label}" wirklich löschen?`)) return
    setDeletingId(id)
    if (type === 'vm') {
      await fetch('/api/vm-bericht', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      })
      setVmBerichte(prev => prev.filter(b => b.id !== id))
    } else {
      await fetch('/api/admin-zeile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_bericht', berichtId: id })
      })
      if (type === 'team') setTeamBerichte(prev => prev.filter(b => b.id !== id))
      else setBerichte(prev => prev.filter(b => b.id !== id))
    }
    setDeletingId(null)
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-gray-800">📊 Ziel & Ergebnis</h1>
        <div className="flex items-center gap-3">
          {profile.is_admin && <Link href="/admin" className="text-sm text-blue-600 font-medium">Admin</Link>}
          <Link href="/analytics" className="text-sm text-blue-600 font-medium">Analytics</Link>
          <Link href="/einstellungen" className="text-sm text-blue-600 font-medium">Einstellungen</Link>
          <div className="flex items-center gap-2">
            <UserAvatar url={avatarUrl} name={profile.name} size={32} />
            <span className="text-sm text-gray-500">{profile.name}</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600">Abmelden</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Willkommen, {profile.name.split(' ')[0]}!</h2>
            <p className="text-gray-500 text-sm">{profile.karrierestufe === 1 ? 'Planungsvariante VM' : profile.karrierestufe === 2 ? 'Planungsvariante VBA' : 'Planungsvariante HB'}</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Link href="/bericht" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
              + Neuer Wochenbericht
            </Link>
            <Link href="/vm-bericht" className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition">
              + Wochenplanung VM's
            </Link>
          </div>
        </div>

        {/* Eigene Berichte */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-3">Meine Berichte</h3>
          {berichte.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Berichte vorhanden.</p> : (
            <div className="space-y-2">
              {berichte.map(b => {
                const label = `${b.monat} / ${b.woche} ${b.jahr}`
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                    <Link href={`/bericht?id=${b.id}`} className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className="text-xs text-gray-400 mr-3">{new Date(b.updated_at).toLocaleDateString('de-AT')}</span>
                    </Link>
                    <button onClick={() => handleDelete(b.id, label, 'own')} disabled={deletingId === b.id}
                      className="text-gray-300 hover:text-red-500 transition disabled:opacity-40 text-lg leading-none ml-1">
                      {deletingId === b.id ? '...' : '×'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* VM-Berichte */}
        {vmBerichte.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
            <h3 className="font-semibold text-gray-700 mb-3">Wochenplanung VM's</h3>
            <div className="space-y-2">
              {vmBerichte.map(b => {
                const label = `${b.monat} / ${b.woche} ${b.jahr}`
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                    <Link href={`/vm-bericht?id=${b.id}`} className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className="text-xs text-gray-400 mr-3">{new Date(b.updated_at).toLocaleDateString('de-AT')}</span>
                    </Link>
                    <button onClick={() => handleDelete(b.id, label, 'vm')} disabled={deletingId === b.id}
                      className="text-gray-300 hover:text-red-500 transition disabled:opacity-40 text-lg leading-none ml-1">
                      {deletingId === b.id ? '...' : '×'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Team-Berichte */}
        {teamBerichte.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Team-Berichte</h3>
            <div className="space-y-2">
              {teamBerichte.map(b => {
                const label = `${b.profiles?.name} — ${b.monat} / ${b.woche} ${b.jahr}`
                return (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition">
                    <Link href={`/bericht?id=${b.id}&readonly=1`} className="flex-1 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{b.profiles?.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{b.monat} / {b.woche} {b.jahr}</span>
                      </div>
                      <span className="text-xs text-gray-400 mr-3">{new Date(b.updated_at).toLocaleDateString('de-AT')}</span>
                    </Link>
                    <button onClick={() => handleDelete(b.id, label, 'team')} disabled={deletingId === b.id}
                      className="text-gray-300 hover:text-red-500 transition disabled:opacity-40 text-lg leading-none ml-1">
                      {deletingId === b.id ? '...' : '×'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
