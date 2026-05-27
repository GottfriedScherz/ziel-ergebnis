'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']
const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

interface FormZeile { id: string; name: string; reihenfolge: number; stufe_min: number }
interface CellData { [key: string]: number | string }

function BerichtContent() {
  const router = useRouter()
  const params = useSearchParams()
  const berichtId = params.get('id')
  const readonly = params.get('readonly') === '1'

  const [profile, setProfile] = useState<any>(null)
  const [zeilen, setZeilen] = useState<FormZeile[]>([])
  const [monat, setMonat] = useState(MONATE[new Date().getMonth()])
  const [woche, setWoche] = useState('Woche 1')
  const [cells, setCells] = useState<CellData>({})
  const [freitext, setFreitext] = useState('')
  const [eeJahrZiel, setEeJahrZiel] = useState('')
  const [eeJahrStand, setEeJahrStand] = useState('')
  const [eeMonatZiel, setEeMonatZiel] = useState('')
  const [eeMonatStand, setEeMonatStand] = useState('')
  const [vipJahrZiel, setVipJahrZiel] = useState('')
  const [vipJahrStand, setVipJahrStand] = useState('')
  const [vipMonatZiel, setVipMonatZiel] = useState('')
  const [vipMonatStand, setVipMonatStand] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [ownerName, setOwnerName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      const { data: z } = await supabase.from('formular_zeilen').select('*').eq('aktiv', true).gte('stufe_min', 1).order('reihenfolge')
      const filtered = (z || []).filter((row: FormZeile) => row.stufe_min <= prof.karrierestufe)
      setZeilen(filtered)

      if (berichtId) {
        const { data: b } = await supabase.from('berichte').select('*, profiles(name)').eq('id', berichtId).single()
        if (b) {
          setMonat(b.monat); setWoche(b.woche)
          setFreitext(b.freitext || '')
          setEeJahrZiel(b.ee_jahr_ziel || ''); setEeJahrStand(b.ee_jahr_stand || '')
          setEeMonatZiel(b.ee_monat_ziel || ''); setEeMonatStand(b.ee_monat_stand || '')
          setVipJahrZiel(b.vip_jahr_ziel || ''); setVipJahrStand(b.vip_jahr_stand || '')
          setVipMonatZiel(b.vip_monat_ziel || ''); setVipMonatStand(b.vip_monat_stand || '')
          setOwnerName((b.profiles as any)?.name || '')
          const { data: eintr } = await supabase.from('eintraege').select('*').eq('bericht_id', berichtId)
          const c: CellData = {}
          ;(eintr || []).forEach((e: any) => {
            c[`${e.zeile}__${e.tag}__v`] = e.vereinbart
            c[`${e.zeile}__${e.tag}__s`] = e.stattgefunden
          })
          setCells(c)
        }
      }
    })
  }, [berichtId, router])

  function cellKey(zeile: string, tag: string, type: 'v'|'s') { return `${zeile}__${tag}__${type}` }
  function getCell(zeile: string, tag: string, type: 'v'|'s') { return cells[cellKey(zeile, tag, type)] || '' }
  function setCell(zeile: string, tag: string, type: 'v'|'s', val: string) {
    setCells(prev => ({ ...prev, [cellKey(zeile, tag, type)]: val === '' ? '' : parseInt(val) || 0 }))
  }

  async function handleSave() {
    if (!profile || readonly) return
    setSaving(true)
    const supabase = createClient()
    const jahr = new Date().getFullYear()
    const berichtData = {
      user_id: profile.id, monat, woche, jahr,
      freitext,
      ee_jahr_ziel: eeJahrZiel ? parseInt(eeJahrZiel) : null,
      ee_jahr_stand: eeJahrStand ? parseInt(eeJahrStand) : null,
      ee_monat_ziel: eeMonatZiel ? parseInt(eeMonatZiel) : null,
      ee_monat_stand: eeMonatStand ? parseInt(eeMonatStand) : null,
      vip_jahr_ziel: vipJahrZiel ? parseInt(vipJahrZiel) : null,
      vip_jahr_stand: vipJahrStand ? parseInt(vipJahrStand) : null,
      vip_monat_ziel: vipMonatZiel ? parseInt(vipMonatZiel) : null,
      vip_monat_stand: vipMonatStand ? parseInt(vipMonatStand) : null,
      updated_at: new Date().toISOString()
    }

    let bid = berichtId
    if (bid) {
      await supabase.from('berichte').update(berichtData).eq('id', bid)
    } else {
      const { data } = await supabase.from('berichte').upsert({ ...berichtData }, { onConflict: 'user_id,monat,woche,jahr' }).select().single()
      bid = data?.id
    }

    if (bid) {
      await supabase.from('eintraege').delete().eq('bericht_id', bid)
      const eintrRows: any[] = []
      zeilen.forEach(z => {
        DAYS.forEach(tag => {
          const v = getCell(z.name, tag, 'v')
          const s = getCell(z.name, tag, 's')
          if (v !== '' || s !== '') {
            eintrRows.push({ bericht_id: bid, zeile: z.name, tag, vereinbart: v || 0, stattgefunden: s || 0 })
          }
        })
      })
      if (eintrRows.length > 0) await supabase.from('eintraege').insert(eintrRows)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  const isG = (i: number) => i % 2 === 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📊 Ziel & Ergebnis</h1>
        <div className="w-20" />
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {readonly && ownerName && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-4 text-sm text-blue-700">
            Bericht von <strong>{ownerName}</strong> — Nur-Lesen-Ansicht
          </div>
        )}

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 flex-wrap mb-3">
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</label>
              <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50">{profile.name}</div>
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
                {['Woche 1','Woche 2','Woche 3','Woche 4','Woche 5'].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Eigen-Einheiten eingereicht</div>
              <div className="grid grid-cols-3 gap-2 items-center text-xs">
                <span className="text-gray-500 font-semibold">Jahr</span>
                <input type="number" placeholder="Ziel" value={eeJahrZiel} onChange={e => setEeJahrZiel(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="number" placeholder="Stand" value={eeJahrStand} onChange={e => setEeJahrStand(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="text-gray-500 font-semibold">Monat</span>
                <input type="number" placeholder="Ziel" value={eeMonatZiel} onChange={e => setEeMonatZiel(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="number" placeholder="Stand" value={eeMonatStand} onChange={e => setEeMonatStand(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">VIP & more – Teilnehmer</div>
              <div className="grid grid-cols-3 gap-2 items-center text-xs">
                <span className="text-gray-500 font-semibold">Jahr</span>
                <input type="number" placeholder="Ziel" value={vipJahrZiel} onChange={e => setVipJahrZiel(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="number" placeholder="Stand" value={vipJahrStand} onChange={e => setVipJahrStand(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="text-gray-500 font-semibold">Monat</span>
                <input type="number" placeholder="Ziel" value={vipMonatZiel} onChange={e => setVipMonatZiel(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="number" placeholder="Stand" value={vipMonatStand} onChange={e => setVipMonatStand(e.target.value)} disabled={readonly}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="overflow-auto max-h-[520px]">
            <table className="border-collapse" style={{tableLayout:'fixed'}}>
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-50 bg-gray-100 text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-r border-gray-200" style={{width:155,minWidth:155}}>Aktivität</th>
                  {DAYS.map((d,i) => (
                    <th key={d} colSpan={2} className="sticky top-0 z-30 text-center text-xs font-semibold py-2 border-b border-gray-200" style={{width:108, background: isG(i) ? '#c8e0aa' : '#aacde8', color: isG(i) ? '#27500A' : '#0C447C'}}>{d}</th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 top-[37px] z-50 bg-gray-100 border-b border-r border-gray-200" style={{width:155,minWidth:155}} />
                  {DAYS.map((d,i) => ['Vereinbart','Stattgef.'].map((lbl,j) => (
                    <th key={`${d}-${j}`} className="sticky top-[37px] z-30 text-center text-[10px] font-semibold py-1 border-b border-gray-200" style={{width:54, minWidth:54, background: isG(i) ? (j===0?'#d8edbe':'#eaf3de') : (j===0?'#c5def2':'#ddeef9'), color: isG(i)?'#27500A':'#0C447C'}}>{lbl}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z, ri) => (
                  <tr key={z.id}>
                    <td className="sticky left-0 z-20 px-3 py-1.5 text-xs font-medium text-gray-700 border-b border-r border-gray-200" style={{background: ri%2===0?'#fff':'#f9f8f5', minWidth:155, maxWidth:155}}>{z.name}</td>
                    {DAYS.map((tag, di) => (['v','s'] as const).map((type, j) => (
                      <td key={`${tag}-${type}`} className="border-b border-gray-100 p-0.5" style={{width:54, background: isG(di)?(type==='v'?'#d8edbe':'#eaf3de'):(type==='v'?'#c5def2':'#ddeef9')}}>
                        <input type="number" min="0" placeholder="–" disabled={readonly}
                          value={getCell(z.name, tag, type)}
                          onChange={e => setCell(z.name, tag, type, e.target.value)}
                          className="w-full text-center text-sm py-1.5 bg-transparent border-none outline-none focus:bg-blue-50 focus:rounded disabled:opacity-60" />
                      </td>
                    )))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Freitext */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Weitere Vertriebsaktivitäten</label>
          <textarea value={freitext} onChange={e => setFreitext(e.target.value)} disabled={readonly} rows={3}
            placeholder="Freitext für die gesamte Woche – z.B. Events, Sonderaktionen, Notizen..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
        </div>

        {!readonly && (
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Speichern...' : saved ? '✓ Gespeichert' : '💾 Speichern'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BerichtPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>}><BerichtContent /></Suspense>
}
