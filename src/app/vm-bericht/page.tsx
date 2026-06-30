'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const JAHRE = [2024,2025,2026,2027,2028]

function UserAvatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  if (url) return <img src={url} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} className="border-2 border-gray-200 flex-shrink-0" />
  return <div style={{width:size,height:size,borderRadius:'50%',fontSize:size*0.35}} className="bg-blue-100 text-blue-700 flex items-center justify-center font-semibold border-2 border-gray-200 flex-shrink-0">{initials}</div>
}

function getWeekOptions(monatName: string): {label: string, value: string}[] {
  const MONATE_IDX = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const year = new Date().getFullYear()
  const monthIdx = MONATE_IDX.indexOf(monatName)
  if (monthIdx === -1) return []
  const pad = (n: number) => String(n).padStart(2,'0')
  const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.`
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  const firstOfMonth = new Date(year, monthIdx, 1)
  const dow = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
  let monday = dow <= 2 ? new Date(year, monthIdx, 1 - dow) : new Date(year, monthIdx, 1 + (7 - dow))
  const weeks: {label: string, value: string}[] = []
  let weekNum = 1
  while (monday <= new Date(year, monthIdx, lastDay)) {
    const sunday = new Date(monday.getTime() + 6 * 86400000)
    weeks.push({ label: `${fmt(monday)} – ${fmt(sunday)}`, value: `Woche ${weekNum}` })
    weekNum++
    monday = new Date(monday.getTime() + 7 * 86400000)
  }
  return weeks
}

function VmBerichtContent() {
  const router = useRouter()
  const params = useSearchParams()
  const berichtId = params.get('id')

  const [profile, setProfile] = useState<any>(null)
  const [monat, setMonat] = useState(MONATE[new Date().getMonth()])
  const [woche, setWoche] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currentBerichtId, setCurrentBerichtId] = useState<string|null>(null)
  const [rows, setRows] = useState([
    { name: '', mg_geplant: 0, mg_stattgefunden: 0, analysen_geplant: 0, analysen_stattgefunden: 0, ansprache_geplant: 0, ansprache_stattgefunden: 0 }
  ])

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(async data => {
      const prof = data?.[0]
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      // Aktuelle Woche vorauswählen
      const opts = getWeekOptions(MONATE[new Date().getMonth()])
      if (opts.length > 0) setWoche(opts[0].value)

      // Bestehenden Bericht laden wenn ?id=
      if (berichtId) {
        const b = await dbQuery('vm_berichte', `id=eq.${berichtId}&select=*`)
        if (b?.[0]) {
          setMonat(b[0].monat)
          setWoche(b[0].woche)
          setCurrentBerichtId(b[0].id)
          const e = await dbQuery('vm_eintraege', `vm_bericht_id=eq.${berichtId}&select=*`) || []
          if (e.length > 0) setRows(e.map((x: any) => ({
            name: x.name || '',
            mg_geplant: x.mg_geplant || 0,
            mg_stattgefunden: x.mg_stattgefunden || 0,
            analysen_geplant: x.analysen_geplant || 0,
            analysen_stattgefunden: x.analysen_stattgefunden || 0,
            ansprache_geplant: x.ansprache_geplant || 0,
            ansprache_stattgefunden: x.ansprache_stattgefunden || 0,
          })))
        }
      }
    })
  }, [router, berichtId])

  async function saveBericht() {
    if (!profile) return
    setSaving(true)
    const res = await fetch('/api/vm-bericht', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        user_id: profile.id,
        monat, woche,
        jahr: new Date().getFullYear(),
        eintraege: rows.filter(r => r.name.trim()),
        existingId: currentBerichtId
      })
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setSaved(true)
      setCurrentBerichtId(data.id)
      setTimeout(() => { setSaved(false); router.push('/dashboard') }, 1500)
    }
  }

  function updateRow(i: number, field: string, value: any) {
    setRows(prev => prev.map((r, idx) => idx === i
      ? { ...r, [field]: field === 'name' ? value : Math.max(0, parseInt(value) || 0) }
      : r))
  }

  function addRow() {
    setRows(prev => [...prev, { name: '', mg_geplant: 0, mg_stattgefunden: 0, analysen_geplant: 0, analysen_stattgefunden: 0, ansprache_geplant: 0, ansprache_stattgefunden: 0 }])
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📊 Ziel & Ergebnis</h1>
        <div className="w-16" />
      </nav>
      <div className="max-w-2xl mx-auto px-4 py-5">

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</label>
              <div className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 flex items-center gap-3">
                <UserAvatar url={profile.avatar_url} name={profile.name} size={40} />
                <span className="font-semibold text-base text-gray-800">{profile.name}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monat</label>
              <select value={monat} onChange={e => { setMonat(e.target.value); const opts = getWeekOptions(e.target.value); if (opts.length > 0) setWoche(opts[0].value) }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONATE.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Woche</label>
              <select value={woche} onChange={e => setWoche(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {getWeekOptions(monat).map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm">VM-Gespräche dieser Woche</h3>
          </div>
          <div className="overflow-x-auto">
  <table className="w-full text-sm" style={{tableLayout: 'fixed'}}>
    <thead>
      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
        <th className="px-3 py-2 text-left" style={{width: '28%'}}>Name VM</th>
        <th className="px-2 py-2 text-center" style={{width: '12%'}}>MG<br/>Gepl.</th>
        <th className="px-2 py-2 text-center" style={{width: '12%'}}>MG<br/>Stattgef.</th>
        <th className="px-2 py-2 text-center" style={{width: '12%'}}>Analyse<br/>Gepl.</th>
        <th className="px-2 py-2 text-center" style={{width: '12%'}}>Analyse<br/>Stattgef.</th>
        <th className="px-2 py-2 text-center" style={{width: '12%'}}>Einl. VIP/KG<br/>Gepl.</th>
        <th className="px-2 py-2 text-center" style={{width: '12%'}}>Einl. VIP/KG<br/>Stattgef.</th>
        <th className="px-1 py-2" style={{width: '24px'}} />
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i} className="border-t border-gray-100">
          <td className="px-2 py-1.5">
            <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)}
              placeholder="Name..."
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </td>
          {(['mg_geplant','mg_stattgefunden','analysen_geplant','analysen_stattgefunden','ansprache_geplant','ansprache_stattgefunden'] as const).map(field => (
            <td key={field} className="px-1 py-1.5 text-center">
              <input type="number" min={0} value={r[field]} onChange={e => updateRow(i, field, e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-1 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </td>
          ))}
          <td className="px-1 py-1.5">
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
          {saving ? 'Wird gespeichert...' : saved ? '✓ Gespeichert' : '💾 Speichern'}
        </button>
      </div>
    </div>
  )
}

export default function VmBerichtPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>}>
      <VmBerichtContent />
    </Suspense>
  )
}
