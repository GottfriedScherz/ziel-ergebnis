'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const WOCHEN = ['Woche 1','Woche 2','Woche 3','Woche 4']
const JAHRE = [2024,2025,2026,2027,2028]

export default function VmBericht() {
  const [profile, setProfile] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [visibleUsers, setVisibleUsers] = useState<any[]>([])
  const [berichte, setBerichte] = useState<any[]>([])
  const [eintraege, setEintraege] = useState<any[]>([])
  const [monat, setMonat] = useState(MONATE[new Date().getMonth()])
  const [woche, setWoche] = useState('Woche 1')
  const [jahr, setJahr] = useState(new Date().getFullYear())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currentBerichtId, setCurrentBerichtId] = useState<string|null>(null)
  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterMonat, setFilterMonat] = useState<string>('all')
  const [filterJahr, setFilterJahr] = useState<number>(new Date().getFullYear())
  const [view, setView] = useState<'list'|'edit'>('list')
  const [rows, setRows] = useState([
    { name: '', mg_geplant: 0, mg_stattgefunden: 0, analysen_geplant: 0, analysen_stattgefunden: 0 }
  ])
  const router = useRouter()

  function getSubtreeIds(userId: string, users: any[]): string[] {
    const direct = users.filter(u => u.betreuer_id === userId).map(u => u.id)
    return [...direct, ...direct.flatMap(id => getSubtreeIds(id, users))]
  }

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(async data => {
      const prof = data?.[0]
      if (!prof) { router.push('/login'); return }
      setProfile(prof)
      const allProfiles = await dbQuery('profiles', 'select=*&order=name') || []
      setAllUsers(allProfiles)

      // Sichtbare User = eigene Struktur (für Filter-Dropdown)
      const subtreeIds = getSubtreeIds(prof.id, allProfiles)
      const visible = prof.is_admin
        ? allProfiles
        : allProfiles.filter((u: any) => u.id === prof.id || subtreeIds.includes(u.id))
      setVisibleUsers(visible)

      loadAllBerichte(prof, allProfiles)
    })
  }, [router])

  async function loadAllBerichte(prof: any, allProfiles: any[]) {
    const subtreeIds = getSubtreeIds(prof.id, allProfiles)
    const userIds = prof.is_admin
      ? allProfiles.map((u: any) => u.id)
      : [prof.id, ...subtreeIds]

    if (userIds.length === 0) { setBerichte([]); setEintraege([]); return }
    const idFilter = userIds.length === 1
      ? `user_id=eq.${userIds[0]}`
      : `user_id=in.(${userIds.join(',')})`

    const b = await dbQuery('vm_berichte', `${idFilter}&select=*&order=jahr,monat,woche`) || []
    setBerichte(b)
    if (b.length > 0) {
      const e = await dbQuery('vm_eintraege', `vm_bericht_id=in.(${b.map((x: any) => x.id).join(',')})&select=*`) || []
      setEintraege(e)
    } else setEintraege([])
  }

  async function saveBericht() {
    if (!profile) return
    setSaving(true)
    const res = await fetch('/api/vm-bericht', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        user_id: profile.id,
        monat, woche, jahr,
        eintraege: rows.filter(r => r.name.trim()),
        existingId: currentBerichtId
      })
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setCurrentBerichtId(data.id)
      loadAllBerichte(profile, allUsers)
    }
  }

  async function deleteBericht(id: string) {
    if (!confirm('Bericht wirklich löschen?')) return
    await fetch('/api/vm-bericht', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id })
    })
    loadAllBerichte(profile, allUsers)
  }

  function openNew() {
    setRows([{ name: '', mg_geplant: 0, mg_stattgefunden: 0, analysen_geplant: 0, analysen_stattgefunden: 0 }])
    setCurrentBerichtId(null)
    setMonat(MONATE[new Date().getMonth()])
    setWoche('Woche 1')
    setJahr(new Date().getFullYear())
    setView('edit')
  }

  function openEdit(bericht: any) {
    const be = eintraege.filter(x => x.vm_bericht_id === bericht.id)
    setMonat(bericht.monat)
    setWoche(bericht.woche)
    setJahr(parseInt(bericht.jahr))
    setRows(be.length > 0 ? be.map((x: any) => ({
      name: x.name || '',
      mg_geplant: x.mg_geplant || 0,
      mg_stattgefunden: x.mg_stattgefunden || 0,
      analysen_geplant: x.analysen_geplant || 0,
      analysen_stattgefunden: x.analysen_stattgefunden || 0,
    })) : [{ name: '', mg_geplant: 0, mg_stattgefunden: 0, analysen_geplant: 0, analysen_stattgefunden: 0 }])
    setCurrentBerichtId(bericht.id)
    setView('edit')
  }

  // Nur eigene Berichte dürfen bearbeitet/gelöscht werden
  function isOwn(bericht: any) {
    return profile && bericht.user_id === profile.id
  }

  function updateRow(i: number, field: string, value: any) {
    setRows(prev => prev.map((r, idx) => idx === i
      ? { ...r, [field]: field === 'name' ? value : Math.max(0, parseInt(value) || 0) }
      : r))
  }

  function addRow() {
    setRows(prev => [...prev, { name: '', mg_geplant: 0, mg_stattgefunden: 0, analysen_geplant: 0, analysen_stattgefunden: 0 }])
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const filteredBerichte = berichte.filter(b => {
    if (filterUser !== 'all' && b.user_id !== filterUser) return false
    if (filterMonat !== 'all' && b.monat !== filterMonat) return false
    if (String(b.jahr) !== String(filterJahr)) return false
    return true
  })

  function userName(id: string) {
    return allUsers.find(u => u.id === id)?.name || id
  }

  function betreuerName(userId: string) {
    const user = allUsers.find(u => u.id === userId)
    if (!user?.betreuer_id) return '—'
    return allUsers.find(u => u.id === user.betreuer_id)?.name || '—'
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  // ── EDIT VIEW ──────────────────────────────────────────────────────────────
  if (view === 'edit') return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setView('list')} className="text-sm text-blue-600 font-medium">← Übersicht</button>
        <h1 className="font-bold text-gray-800">📋 VM-Bericht {currentBerichtId ? 'bearbeiten' : 'erfassen'}</h1>
        <div className="w-20" />
      </nav>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monat</label>
            <select value={monat} onChange={e => setMonat(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MONATE.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Woche</label>
            <select value={woche} onChange={e => setWoche(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {WOCHEN.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jahr</label>
            <select value={jahr} onChange={e => setJahr(parseInt(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {JAHRE.map(j => <option key={j}>{j}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm">VM-Gespräche dieser Woche</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Name / Kunde</th>
                  <th className="px-3 py-2 text-center">MG geplant</th>
                  <th className="px-3 py-2 text-center">MG stattgef.</th>
                  <th className="px-3 py-2 text-center">Analyse gepl.</th>
                  <th className="px-3 py-2 text-center">Analyse stattgef.</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)}
                        placeholder="Name..."
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    {(['mg_geplant', 'mg_stattgefunden', 'analysen_geplant', 'analysen_stattgefunden'] as const).map(field => (
                      <td key={field} className="px-3 py-2 text-center">
                        <input type="number" min={0} value={r[field]} onChange={e => updateRow(i, field, e.target.value)}
                          className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 transition text-lg leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100">
            <button onClick={addRow} className="text-sm text-blue-600 font-medium hover:text-blue-800 transition">+ Zeile hinzufügen</button>
          </div>
        </div>

        <button onClick={saveBericht} disabled={saving}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
          {saving ? 'Wird gespeichert...' : saved ? '✓ Gespeichert' : '💾 Bericht speichern'}
        </button>
      </div>
    </div>
  )

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📋 VM-Berichte</h1>
        <button onClick={openNew}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition">
          + Neu
        </button>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Person</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Alle</option>
              {visibleUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monat</label>
            <select value={filterMonat} onChange={e => setFilterMonat(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Alle</option>
              {MONATE.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Jahr</label>
            <select value={filterJahr} onChange={e => setFilterJahr(parseInt(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {JAHRE.map(j => <option key={j}>{j}</option>)}
            </select>
          </div>
        </div>

        {filteredBerichte.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Noch keine VM-Berichte vorhanden.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBerichte.map(b => {
              const be = eintraege.filter(e => e.vm_bericht_id === b.id)
              const mgSum = be.reduce((s: number, e: any) => s + (e.mg_stattgefunden || 0), 0)
              const analysenSum = be.reduce((s: number, e: any) => s + (e.analysen_stattgefunden || 0), 0)
              return (
                <div key={b.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{userName(b.user_id)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Betreuer: {betreuerName(b.user_id)}</div>
                      <div className="text-xs text-gray-500 mt-1">{b.monat} · {b.woche} · {b.jahr}</div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600">{mgSum}</div>
                        <div className="text-xs text-gray-400">MG</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">{analysenSum}</div>
                        <div className="text-xs text-gray-400">Analysen</div>
                      </div>
                      {isOwn(b) && (
                        <div className="flex gap-2 ml-2">
                          <button onClick={() => openEdit(b)}
                            className="text-xs text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition font-medium">
                            Bearbeiten
                          </button>
                          <button onClick={() => deleteBericht(b.id)}
                            className="text-xs text-red-500 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition font-medium">
                            Löschen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {be.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 overflow-x-auto">
                      <table className="w-full text-xs text-gray-600">
                        <thead>
                          <tr className="text-gray-400">
                            <th className="text-left pb-1">Name</th>
                            <th className="text-center pb-1">MG gepl.</th>
                            <th className="text-center pb-1">MG stattgef.</th>
                            <th className="text-center pb-1">Analyse gepl.</th>
                            <th className="text-center pb-1">Analyse stattgef.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {be.map((e: any, i: number) => (
                            <tr key={i} className="border-t border-gray-50">
                              <td className="py-1">{e.name}</td>
                              <td className="text-center py-1">{e.mg_geplant || 0}</td>
                              <td className="text-center py-1 font-medium text-blue-600">{e.mg_stattgefunden || 0}</td>
                              <td className="text-center py-1">{e.analysen_geplant || 0}</td>
                              <td className="text-center py-1 font-medium text-amber-600">{e.analysen_stattgefunden || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
