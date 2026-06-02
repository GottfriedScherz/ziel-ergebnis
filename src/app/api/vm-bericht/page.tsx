'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function getWeekOptions(monatName: string) {
  const year = new Date().getFullYear()
  const monthIdx = MONATE.indexOf(monatName)
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

const EMPTY_ROW = () => ({ name: '', mg_geplant: '', mg_stattgefunden: '', analysen_geplant: '', analysen_stattgefunden: '' })

function VmBerichtContent() {
  const router = useRouter()
  const params = useSearchParams()
  const berichtId = params.get('id')
  const readonly = params.get('readonly') === '1'

  const [profile, setProfile] = useState<any>(null)
  const [ownerName, setOwnerName] = useState('')
  const [monat, setMonat] = useState(MONATE[new Date().getMonth()])
  const [woche, setWoche] = useState('Woche 1')
  const [rows, setRows] = useState([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existingId, setExistingId] = useState<string|null>(null)

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(async data => {
      const prof = data?.[0]
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      if (berichtId) {
        const res = await fetch('/api/vm-bericht', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', id: berichtId })
        })
        const data = await res.json()
        if (data.bericht) {
          setMonat(data.bericht.monat)
          setWoche(data.bericht.woche)
          setOwnerName(data.bericht.profiles?.name || '')
          setExistingId(data.bericht.id)
          if (data.eintraege?.length > 0) {
            const filled = Array.from({ length: 5 }, (_, i) => {
              const e = data.eintraege[i]
              return e ? {
                name: e.name || '',
                mg_geplant: e.mg_geplant ?? '',
                mg_stattgefunden: e.mg_stattgefunden ?? '',
                analysen_geplant: e.analysen_geplant ?? '',
                analysen_stattgefunden: e.analysen_stattgefunden ?? '',
              } : EMPTY_ROW()
            })
            setRows(filled)
          }
        }
      }
    })
  }, [berichtId, router])

  function updateRow(i: number, field: string, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  async function handleSave() {
    if (!profile || readonly) return
    setSaving(true)
    const eintraege = rows
      .filter(r => r.name.trim() !== '')
      .map(r => ({
        name: r.name,
        mg_geplant: r.mg_geplant !== '' ? parseInt(r.mg_geplant as string) : null,
        mg_stattgefunden: r.mg_stattgefunden !== '' ? parseInt(r.mg_stattgefunden as string) : null,
        analysen_geplant: r.analysen_geplant !== '' ? parseInt(r.analysen_geplant as string) : null,
        analysen_stattgefunden: r.analysen_stattgefunden !== '' ? parseInt(r.analysen_stattgefunden as string) : null,
      }))

    const res = await fetch('/api/vm-bericht', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        user_id: profile.id,
        monat, woche,
        jahr: new Date().getFullYear(),
        eintraege,
        existingId,
      })
    })
    const data = await res.json()
    if (data.id && !existingId) setExistingId(data.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  const displayName = readonly && ownerName ? ownerName : profile.name

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📊 Wochenplanung VM's</h1>
        <div className="w-20" />
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {readonly && ownerName && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-4 text-sm text-blue-700">
            Bericht von <strong>{ownerName}</strong> — Nur-Lesen-Ansicht
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1 flex-1 min-w-40">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Partner</label>
              <div className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50">
                {displayName}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monat</label>
              <select value={monat} onChange={e => setMonat(e.target.value)} disabled={readonly}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONATE.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Woche</label>
              <select value={woche} onChange={e => setWoche(e.target.value)} disabled={readonly}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {getWeekOptions(monat).map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tabelle */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{width: '35%'}}>Name</th>
                <th className="text-center px-2 py-3 text-xs font-semibold uppercase" style={{background:'#d8edbe', color:'#27500A'}}>MG geplant</th>
                <th className="text-center px-2 py-3 text-xs font-semibold uppercase" style={{background:'#eaf3de', color:'#27500A'}}>MG stattgef.</th>
                <th className="text-center px-2 py-3 text-xs font-semibold uppercase" style={{background:'#c5def2', color:'#0C447C'}}>Analysen geplant</th>
                <th className="text-center px-2 py-3 text-xs font-semibold uppercase" style={{background:'#ddeef9', color:'#0C447C'}}>Analysen stattgef.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 border-b border-gray-100">
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => updateRow(i, 'name', e.target.value)}
                      disabled={readonly}
                      placeholder={`VM ${i + 1}`}
                      className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 bg-white"
                    />
                  </td>
                  {(['mg_geplant','mg_stattgefunden','analysen_geplant','analysen_stattgefunden'] as const).map((field, fi) => (
                    <td key={field} className="px-2 py-2 border-b border-gray-100" style={{background: fi===0?'#d8edbe':fi===1?'#eaf3de':fi===2?'#c5def2':'#ddeef9'}}>
                      <input
                        type="number"
                        min="0"
                        value={row[field]}
                        onChange={e => updateRow(i, field, e.target.value)}
                        disabled={readonly}
                        placeholder="–"
                        className="w-full text-center text-sm py-1.5 bg-transparent border-none outline-none focus:bg-white/60 focus:rounded disabled:opacity-60"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!readonly && (
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Speichern...' : saved ? '✓ Gespeichert' : '💾 Speichern'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function VmBerichtPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>}><VmBerichtContent /></Suspense>
}
