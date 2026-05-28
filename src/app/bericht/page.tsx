'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { dbQuery, dbInsert, dbUpdate, dbDelete, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']

function getWeekOptions(monatName: string): {label: string, value: string}[] {
  const MONATE_IDX = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  const year = new Date().getFullYear()
  const monthIdx = MONATE_IDX.indexOf(monatName)
  if (monthIdx === -1) return []
  
  const pad = (n: number) => String(n).padStart(2,'0')
  const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.`
  
  const weeks: {label: string, value: string}[] = []
  let day = new Date(year, monthIdx, 1)
  let weekNum = 1
  
  while (day.getMonth() === monthIdx) {
    const start = new Date(day)
    // Find end of week (Sunday) or end of month
    const end = new Date(day)
    end.setDate(end.getDate() + (6 - end.getDay() === -1 ? 6 : 6 - end.getDay()))
    if (end.getDay() === 0 && end !== start) end.setDate(end.getDate())
    // Cap at end of month
    const lastDay = new Date(year, monthIdx + 1, 0)
    const weekEnd = end > lastDay ? lastDay : end
    
    weeks.push({
      label: `Woche ${weekNum} (${fmt(start)} – ${fmt(weekEnd)})`,
      value: `Woche ${weekNum}`
    })
    weekNum++
    // Move to next Monday
    day = new Date(weekEnd)
    day.setDate(day.getDate() + 1)
  }
  return weeks
}
const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function BerichtContent() {
  const router = useRouter()
  const params = useSearchParams()
  const berichtId = params.get('id')
  const readonly = params.get('readonly') === '1'

  const [profile, setProfile] = useState<any>(null)
  const [zeilen, setZeilen] = useState<any[]>([])
  const [monat, setMonat] = useState(MONATE[new Date().getMonth()])
  const [woche, setWoche] = useState('Woche 1')
  const [cells, setCells] = useState<any>({})
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
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(async data => {
      const prof = data?.[0]
      if (!prof) { router.push('/login'); return }
      setProfile(prof)

      const z = await dbQuery('formular_zeilen', `aktiv=eq.true&order=reihenfolge`)
      setZeilen((z || []).filter((row: any) => row.stufe_min <= prof.karrierestufe))

      if (berichtId) {
        const b = await dbQuery('berichte', `id=eq.${berichtId}&select=*,profiles(name)`)
        if (b?.[0]) {
          const bericht = b[0]
          setMonat(bericht.monat); setWoche(bericht.woche)
          setFreitext(bericht.freitext || '')
          setEeJahrZiel(bericht.ee_jahr_ziel ?? ''); setEeJahrStand(bericht.ee_jahr_stand ?? '')
          setEeMonatZiel(bericht.ee_monat_ziel ?? ''); setEeMonatStand(bericht.ee_monat_stand ?? '')
          setVipJahrZiel(bericht.vip_jahr_ziel ?? ''); setVipJahrStand(bericht.vip_jahr_stand ?? '')
          setVipMonatZiel(bericht.vip_monat_ziel ?? ''); setVipMonatStand(bericht.vip_monat_stand ?? '')
          setOwnerName(bericht.profiles?.name || '')
          const eintr = await dbQuery('eintraege', `bericht_id=eq.${berichtId}&select=*`)
          const c: any = {}
          ;(eintr || []).forEach((e: any) => {
            c[`${e.zeile}__${e.tag}__v`] = e.vereinbart
            c[`${e.zeile}__${e.tag}__s`] = e.stattgefunden
          })
          setCells(c)
        }
      }
    })
  }, [berichtId, router])

  function getCell(zeile: string, tag: string, type: 'v'|'s') { return cells[`${zeile}__${tag}__${type}`] ?? '' }
  function setCell(zeile: string, tag: string, type: 'v'|'s', val: string) {
    setCells((prev: any) => ({ ...prev, [`${zeile}__${tag}__${type}`]: val === '' ? '' : parseInt(val) || 0 }))
  }

  async function handleSave() {
    if (!profile || readonly) return
    setSaving(true)
    const jahr = new Date().getFullYear()
    const berichtData = {
      user_id: profile.id, monat, woche, jahr, freitext,
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
      await dbUpdate('berichte', `id=eq.${bid}`, berichtData)
    } else {
      const existing = await dbQuery('berichte', `user_id=eq.${profile.id}&monat=eq.${monat}&woche=eq.${woche}&jahr=eq.${jahr}`)
      if (existing?.[0]) {
        bid = existing[0].id
        await dbUpdate('berichte', `id=eq.${bid}`, berichtData)
      } else {
        const res = await dbInsert('berichte', berichtData)
        bid = res?.[0]?.id
      }
    }

    if (bid) {
      await dbDelete('eintraege', `bericht_id=eq.${bid}`)
      const rows: any[] = []
      zeilen.forEach(z => {
        DAYS.forEach(tag => {
          const v = getCell(z.name, tag, 'v')
          const s = getCell(z.name, tag, 's')
          if (v !== '' || s !== '') rows.push({ bericht_id: bid, zeile: z.name, tag, vereinbart: v || 0, stattgefunden: s || 0 })
        })
      })
      if (rows.length > 0) await dbInsert('eintraege', rows)
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
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <div className="flex gap-3 flex-wrap mb-3">
            <div className="flex flex-col gap-1 flex-1 min-w-48">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</label>
              <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50">{readonly && ownerName ? ownerName : profile.name}</div>
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
          <div className="grid grid-cols-2 gap-3">
            {[['Eigen-Einheiten eingereicht', eeJahrZiel, setEeJahrZiel, eeJahrStand, setEeJahrStand, eeMonatZiel, setEeMonatZiel, eeMonatStand, setEeMonatStand],
              ['VIP & more – Teilnehmer', vipJahrZiel, setVipJahrZiel, vipJahrStand, setVipJahrStand, vipMonatZiel, setVipMonatZiel, vipMonatStand, setVipMonatStand]
            ].map(([label, jz, sjz, js, sjs, mz, smz, ms, sms]: any) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{label}</div>
                <div className="grid grid-cols-3 gap-2 items-center text-xs">
                  <span className="text-gray-500 font-semibold">Jahr</span>
                  <input type="number" placeholder="Ziel" value={jz} onChange={(e: any) => sjz(e.target.value)} disabled={readonly}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none" />
                  <input type="number" placeholder="Stand" value={js} onChange={(e: any) => sjs(e.target.value)} disabled={readonly}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none" />
                  <span className="text-gray-500 font-semibold">Monat</span>
                  <input type="number" placeholder="Ziel" value={mz} onChange={(e: any) => smz(e.target.value)} disabled={readonly}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none" />
                  <input type="number" placeholder="Stand" value={ms} onChange={(e: any) => sms(e.target.value)} disabled={readonly}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center bg-white focus:outline-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
          <div className="overflow-auto max-h-[520px]">
            <table className="border-collapse" style={{tableLayout:'fixed'}}>
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-50 bg-gray-100 text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b border-r border-gray-200" style={{width:155,minWidth:155}}>Aktivität</th>
                  {DAYS.map((d,i) => (
                    <th key={d} colSpan={2} className="sticky top-0 z-30 text-center text-xs font-semibold py-2 border-b border-gray-200" style={{width:108,background:isG(i)?'#c8e0aa':'#aacde8',color:isG(i)?'#27500A':'#0C447C'}}>{d}</th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 top-[37px] z-50 bg-gray-100 border-b border-r border-gray-200" style={{width:155,minWidth:155}} />
                  {DAYS.map((d,i) => ['Vereinbart','Stattgef.'].map((lbl,j) => (
                    <th key={`${d}-${j}`} className="sticky top-[37px] z-30 text-center text-[10px] font-semibold py-1 border-b border-gray-200" style={{width:54,minWidth:54,background:isG(i)?(j===0?'#d8edbe':'#eaf3de'):(j===0?'#c5def2':'#ddeef9'),color:isG(i)?'#27500A':'#0C447C'}}>{lbl}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z, ri) => (
                  <tr key={z.id}>
                    <td className="sticky left-0 z-20 px-3 py-1.5 text-xs font-medium text-gray-700 border-b border-r border-gray-200" style={{background:ri%2===0?'#fff':'#f9f8f5',minWidth:155,maxWidth:155}}>{z.name}</td>
                    {DAYS.map((tag,di) => (['v','s'] as const).map((type,j) => (
                      <td key={`${tag}-${type}`} className="border-b border-gray-100 p-0.5" style={{width:54,background:isG(di)?(type==='v'?'#d8edbe':'#eaf3de'):(type==='v'?'#c5def2':'#ddeef9')}}>
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
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Weitere Vertriebsaktivitäten</label>
          <textarea value={freitext} onChange={e => setFreitext(e.target.value)} disabled={readonly} rows={3}
            placeholder="Freitext für die gesamte Woche..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
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

export default function BerichtPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>}><BerichtContent /></Suspense>
}
