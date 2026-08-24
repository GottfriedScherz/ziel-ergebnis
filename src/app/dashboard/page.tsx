'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, dbDelete, getUser, getToken, logout } from '@/lib/supabase'
import Link from 'next/link'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function getWeekOptions(monatName: string, jahr: number): {label: string, value: string, start: Date}[] {
  const monthIdx = MONATE.indexOf(monatName)
  if (monthIdx === -1) return []
  const pad = (n: number) => String(n).padStart(2,'0')
  const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`
  const lastDay = new Date(jahr, monthIdx + 1, 0).getDate()
  const firstOfMonth = new Date(jahr, monthIdx, 1)
  const dow = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
  let monday = dow <= 2 ? new Date(jahr, monthIdx, 1 - dow) : new Date(jahr, monthIdx, 1 + (7 - dow))
  const weeks: {label: string, value: string, start: Date}[] = []
  let weekNum = 1
  while (monday <= new Date(jahr, monthIdx, lastDay)) {
    const sunday = new Date(monday.getTime() + 6 * 86400000)
    weeks.push({ label: `${fmt(monday)} – ${fmt(sunday)}`, value: `Woche ${weekNum}`, start: new Date(monday) })
    weekNum++
    monday = new Date(monday.getTime() + 7 * 86400000)
  }
  return weeks
}

function getWeekLabel(monat: string, woche: string, jahr: number): string {
  const opts = getWeekOptions(monat, jahr)
  const match = opts.find(w => w.value === woche)
  return match ? match.label : `${monat} / ${woche} ${jahr}`
}

function getWeekSortKey(monat: string, woche: string, jahr: number): number {
  const opts = getWeekOptions(monat, jahr)
  const match = opts.find(w => w.value === woche)
  return match ? match.start.getTime() : 0
}

function UserAvatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  if (url) return <img src={url} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} className="border-2 border-gray-200" />
  return <div style={{width:size,height:size,borderRadius:'50%',fontSize:size*0.35}} className="bg-blue-100 text-blue-700 flex items-center justify-center font-semibold border-2 border-gray-200">{initials}</div>
}

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [berichte, setBerichte] = useState<any[]>([])
  const [vmBerichte, setVmBerichte] = useState<any[]>([])
  const [teamBerichte, setTeamBerichte] = useState<any[]>([])
  const [eintraege, setEintraege] = useState<any[]>([])
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

      const allProfiles = await dbQuery('profiles', 'select=*') || []
      setAllUsers(allProfiles)

      const eigene = await dbQuery('berichte', `user_id=eq.${user.id}&select=*&order=updated_at.desc&limit=20`) || []
      setBerichte(eigene)

      dbQuery('vm_berichte', `user_id=eq.${user.id}&select=*&order=updated_at.desc&limit=10`).then(d => setVmBerichte(d || []))

      let team: any[] = []
      if (p.is_admin) {
        team = await dbQuery('berichte', `user_id=neq.${user.id}&select=*,profiles(name)&order=updated_at.desc&limit=50`) || []
      } else {
        const teamMembers = await dbQuery('profiles', `betreuer_id=eq.${user.id}&select=id`) || []
        if (teamMembers.length > 0) {
          const ids = teamMembers.map((m: any) => m.id).join(',')
          team = await dbQuery('berichte', `user_id=in.(${ids})&select=*,profiles(name)&order=updated_at.desc&limit=50`) || []
        }
      }
      setTeamBerichte(team)

      const allBerichte = [...eigene, ...team]
      if (allBerichte.length > 0) {
        const ids = allBerichte.map((b: any) => b.id).join(',')
        const e = await dbQuery('eintraege', `bericht_id=in.(${ids})&select=bericht_id,vereinbart,stattgefunden`) || []
        setEintraege(e)
      }
    })
  }, [router])

  function handleLogout() { logout(); router.push('/login') }

  function getBerichtTags(berichtId: string) {
    const be = eintraege.filter(e => e.bericht_id === berichtId)
    return {
      hatZiele: be.some(e => (e.vereinbart || 0) > 0),
      hatErgebnisse: be.some(e => (e.stattgefunden || 0) > 0)
    }
  }

  function getMissingUsersForWeek(weekItems: any[]): any[] {
    const vorhandeneUserIds = new Set(weekItems.map((b: any) => b.user_id))
    // Gesamte rekursive Downline des eingeloggten Users
    function subtree(userId: string, users: any[]): string[] {
      const direct = users.filter((u: any) => u.betreuer_id === userId).map((u: any) => u.id)
      return [...direct, ...direct.flatMap((id: string) => subtree(id, users))]
    }
    const subtreeIds = profile?.is_admin
      ? allUsers.map((u: any) => u.id)
      : subtree(profile?.id, allUsers)
    const visibleUserIds = new Set(subtreeIds)
    return allUsers.filter((u: any) =>
      !u.planung_nicht_erforderlich &&
      profile && u.id !== profile.id &&
      visibleUserIds.has(u.id) &&
      !vorhandeneUserIds.has(u.id)
    )
  }

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

  const sortedBerichte = [...berichte].sort((a, b) =>
    getWeekSortKey(b.monat, b.woche, b.jahr) - getWeekSortKey(a.monat, a.woche, a.jahr)
  )

  const allTeamEntries = [
    ...teamBerichte.map(b => ({ ...b, _type: 'team' as const })),
    ...vmBerichte.map(b => ({ ...b, _type: 'vm' as const })),
  ].sort((a, b) => getWeekSortKey(b.monat, b.woche, b.jahr) - getWeekSortKey(a.monat, a.woche, a.jahr))

  function groupByWeek<T extends {monat: string, woche: string, jahr: number}>(items: T[]): {key: string, label: string, items: T[]}[] {
    const groups: Record<string, {key: string, label: string, items: T[]}> = {}
    items.forEach(b => {
      const key = `${b.jahr}-${b.monat}-${b.woche}`
      if (!groups[key]) groups[key] = { key, label: getWeekLabel(b.monat, b.woche, b.jahr), items: [] }
      groups[key].items.push(b)
    })
    return Object.values(groups)
  }

  const berichteGruppen = groupByWeek(sortedBerichte)
  const teamGruppen = groupByWeek(allTeamEntries)

  function renderTags(berichtId: string) {
    const { hatZiele, hatErgebnisse } = getBerichtTags(berichtId)
    return (
      <div className="flex gap-1 ml-2 flex-shrink-0">
        {hatZiele && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Ziel</span>}
        {hatErgebnisse && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Ergebnis</span>}
      </div>
    )
  }

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
              + Neue Wochenplanung
            </Link>
            <Link href="/vm-bericht" className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition">
              + Neue Wochenplanung VM's
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-3">Meine Berichte</h3>
          {berichteGruppen.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Berichte vorhanden.</p> : (
            <div>
              {berichteGruppen.map((gruppe, gi) => (
                <div key={gruppe.key}>
                  {gi > 0 && <div className="border-t border-gray-100 my-3" />}
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">{gruppe.label}</div>
                  {gruppe.items.map(b => {
                    const label = getWeekLabel(b.monat, b.woche, b.jahr)
                    return (
                      <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition mb-1">
                        <Link href={`/bericht?id=${b.id}`} className="flex-1 flex items-center min-w-0">
                          <span className="text-sm font-medium text-gray-700 truncate">{label}</span>
                          {renderTags(b.id)}
                        </Link>
                        <button onClick={() => handleDelete(b.id, label, 'own')} disabled={deletingId === b.id}
                          className="text-gray-300 hover:text-red-500 transition disabled:opacity-40 text-lg leading-none ml-2 flex-shrink-0">
                          {deletingId === b.id ? '...' : '×'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {(allTeamEntries.length > 0 || allUsers.some(u => !u.planung_nicht_erforderlich && u.id !== profile.id)) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Team-Berichte</h3>
            <div>
              {teamGruppen.map((gruppe, gi) => (
                <div key={gruppe.key}>
                  {gi > 0 && <div className="border-t border-gray-100 my-3" />}
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1.5">{gruppe.label}</div>
                  {getMissingUsersForWeek(gruppe.items).map(u => (
                    <div key={'missing-' + u.id} className="flex items-center p-3 rounded-lg border border-red-200 bg-red-50 mb-1">
                      <span className="text-sm font-medium text-red-600">⚠ {u.name} — Wochenplanung fehlt</span>
                    </div>
                  ))}
                  {gruppe.items.map(b => {
                    if ((b as any)._type === 'vm') {
                      const ownerName = allUsers.find((u: any) => u.id === b.user_id)?.name || ''
                      const label = `${ownerName} — VM's ${getWeekLabel(b.monat, b.woche, b.jahr)}`
                      return (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition mb-1">
                          <Link href={`/vm-bericht?id=${b.id}`} className="flex-1 flex items-center min-w-0">
                            <span className="text-sm font-medium text-gray-700">{ownerName} — VM's</span>
                          </Link>
                          <button onClick={() => handleDelete(b.id, label, 'vm')} disabled={deletingId === b.id}
                            className="text-gray-300 hover:text-red-500 transition disabled:opacity-40 text-lg leading-none ml-2 flex-shrink-0">
                            {deletingId === b.id ? '...' : '×'}
                          </button>
                        </div>
                      )
                    }
                    const label = `${(b as any).profiles?.name} — ${getWeekLabel(b.monat, b.woche, b.jahr)}`
                    return (
                      <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition mb-1">
                        <Link href={`/bericht?id=${b.id}&readonly=1`} className="flex-1 flex items-center min-w-0">
                          <span className="text-sm font-medium text-gray-700">{(b as any).profiles?.name}</span>
                          {renderTags(b.id)}
                        </Link>
                        <button onClick={() => handleDelete(b.id, label, 'team')} disabled={deletingId === b.id}
                          className="text-gray-300 hover:text-red-500 transition disabled:opacity-40 text-lg leading-none ml-2 flex-shrink-0">
                          {deletingId === b.id ? '...' : '×'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
