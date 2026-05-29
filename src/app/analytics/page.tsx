'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const LINE_COLORS = ['#2a6fa8','#27500A','#d97706','#dc2626','#0891b2','#65a30d','#7c3aed','#db2777']
const JAHRE = [2024, 2025, 2026, 2027, 2028]

const PRINT_STYLES = `
@media print {
  @page { size: A4 portrait; margin: 12mm 15mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  nav { display: none !important; }
  .print-container { max-width: 100% !important; padding: 0 !important; }
  .rounded-2xl { border-radius: 4px !important; }
  .mb-5 { margin-bottom: 8px !important; }
  .recharts-wrapper, .recharts-surface { max-width: 100% !important; }
}
`

function monatIndex(monat: string) { return MONATE.indexOf(monat) }

export default function Analytics() {
  const [profile, setProfile] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [visibleUsers, setVisibleUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [inclSubtree, setInclSubtree] = useState(true)
  const [berichte, setBerichte] = useState<any[]>([])
  const [eintraege, setEintraege] = useState<any[]>([])
  const [vonMonat, setVonMonat] = useState('Jänner')
  const [vonJahr, setVonJahr] = useState(new Date().getFullYear())
  const [bisMonat, setBisMonat] = useState(MONATE[new Date().getMonth()])
  const [bisJahr, setBisJahr] = useState(new Date().getFullYear())
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})
  const [formularZeilen, setFormularZeilen] = useState<{name: string, stufe_min: number}[]>([])
  const router = useRouter()

  function getSubtreeIds(userId: string, users: any[]): string[] {
    const direct = users.filter(u => u.betreuer_id === userId).map(u => u.id)
    const indirect = direct.flatMap(id => getSubtreeIds(id, users))
    return [...direct, ...indirect]
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
      let visible: any[]
      if (prof.is_admin) {
        visible = allProfiles
      } else {
        const subtreeIds = getSubtreeIds(prof.id, allProfiles)
        visible = allProfiles.filter((u: any) => u.id === prof.id || subtreeIds.includes(u.id))
      }
      setVisibleUsers(visible)
      const zeilen = await dbQuery('formular_zeilen', 'aktiv=eq.true&order=reihenfolge') || []
      setFormularZeilen(zeilen.map((z: any) => ({ name: z.name, stufe_min: z.stufe_min })))
    })
  }, [router])

  useEffect(() => {
    if (!profile || visibleUsers.length === 0) return
    loadData()
  }, [selectedUser, inclSubtree, profile, visibleUsers])

  async function loadData() {
    let userIds: string[]
    if (selectedUser === 'all') {
      userIds = visibleUsers.map((u: any) => u.id)
    } else if (inclSubtree) {
      const subtreeIds = getSubtreeIds(selectedUser, allUsers)
      userIds = [selectedUser, ...subtreeIds]
    } else {
      userIds = [selectedUser]
    }
    if (userIds.length === 0) return
    const idFilter = userIds.length === 1
      ? `user_id=eq.${userIds[0]}`
      : `user_id=in.(${userIds.join(',')})`
    const b = await dbQuery('berichte', `${idFilter}&select=*&order=jahr,monat,woche`) || []
    // Sort correctly by jahr, monat index, woche number
    b.sort((a: any, b: any) => {
      const aVal = parseInt(a.jahr) * 1000 + monatIndex(a.monat) * 10 + parseInt(a.woche.replace('Woche ', ''))
      const bVal = parseInt(b.jahr) * 1000 + monatIndex(b.monat) * 10 + parseInt(b.woche.replace('Woche ', ''))
      return aVal - bVal
    })
    setBerichte(b)
    if (b.length > 0) {
      const bIds = b.map((x: any) => x.id)
      const e = await dbQuery('eintraege', `bericht_id=in.(${bIds.join(',')})&select=*`) || []
      setEintraege(e)
    } else {
      setEintraege([])
    }
  }

  useEffect(() => { if (profile && visibleUsers.length > 0) loadData() }, [vonMonat, vonJahr, bisMonat, bisJahr])

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  const filteredBerichte = berichte.filter(b => {
    const bJahr = parseInt(b.jahr)
    const bMonatIdx = monatIndex(b.monat)
    const vonVal = vonJahr * 12 + monatIndex(vonMonat)
    const bisVal = bisJahr * 12 + monatIndex(bisMonat)
    const bVal = bJahr * 12 + bMonatIdx
    return bVal >= vonVal && bVal <= bisVal
  })

  // Determine max karrierestufe of selected users
  function getMaxStufe(): number {
    if (selectedUser === 'all') {
      return Math.max(...visibleUsers.map((u: any) => u.karrierestufe || 1), 1)
    }
    let userIds = inclSubtree
      ? [selectedUser, ...getSubtreeIds(selectedUser, allUsers)]
      : [selectedUser]
    return Math.max(...userIds.map(id => {
      const u = allUsers.find((x: any) => x.id === id)
      return u?.karrierestufe || 1
    }), 1)
  }

  const maxStufe = getMaxStufe()
  const relevanteZeilen = formularZeilen.filter(z => z.stufe_min <= maxStufe)
  const aktivitaetenZeilen = relevanteZeilen.filter(z => z.name !== 'Einheiten').map(z => z.name)
  const einheitenZeile = relevanteZeilen.find(z => z.name === 'Einheiten')?.name || null

  const buildChartData = (zeilen: string[]) => filteredBerichte.map(b => {
    const be = eintraege.filter(e => e.bericht_id === b.id)
    const sum = (zeile: string) => be.filter(e => e.zeile === zeile).reduce((s, e: any) => s + (e.stattgefunden || 0), 0)
    const user = allUsers.find((u: any) => u.id === b.user_id)
    const name = `${b.monat.slice(0,3)} W${b.woche.replace('Woche ', '')}${selectedUser === 'all' ? ` (${user?.name?.split(' ')[0] || ''})` : ''}`
    const entry: any = { name }
    zeilen.forEach(z => { entry[z] = sum(z) })
    return entry
  })

  const aktivitaetenData = buildChartData(aktivitaetenZeilen)
  const einheitenData = einheitenZeile ? buildChartData([einheitenZeile]) : []

  const total = (zeile: string) => eintraege
    .filter(e => filteredBerichte.find(b => b.id === e.bericht_id))
    .filter(e => e.zeile === zeile)
    .reduce((s, e: any) => s + (e.stattgefunden || 0), 0)

  function toggleLine(key: string) {
    setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const hasSubtree = selectedUser !== 'all' && getSubtreeIds(selectedUser, allUsers).length > 0

  function renderLegendButtons(zeilen: string[], colors: string[]) {
    return (
      <div className="grid grid-cols-4 gap-3 mb-5 md:grid-cols-6 lg:grid-cols-8 flex-wrap">
  {relevanteZeilen.map(({ name }, i) => (
    <div key={name} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <div className="text-2xl font-bold" style={{color: LINE_COLORS[i % LINE_COLORS.length]}}>
        {total(name)}
      </div>
      <div className="text-xs text-gray-500 mt-0.5 leading-tight">{name}</div>
    </div>
  ))}
</div>

  const printLabel = `${selectedUser === 'all' ? 'Gesamte Struktur' : visibleUsers.find((u: any) => u.id === selectedUser)?.name || ''}${inclSubtree && selectedUser !== 'all' ? ' inkl. Unterstruktur' : ''} — ${vonMonat} ${vonJahr} bis ${bisMonat} ${bisJahr}`

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{PRINT_STYLES}</style>
      <div className="hidden print:block mb-4 text-sm text-gray-600 font-medium">
        📈 Analytics — {printLabel}
      </div>
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between no-print">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📈 Analytics</h1>
        <button onClick={() => window.print()}
          className="text-gray-500 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100"
          title="Drucken">
          🖨️
        </button>
      </nav>
      <div className="max-w-5xl mx-auto px-4 py-6 print-container">

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 flex gap-3 flex-wrap items-end no-print">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ansicht</label>
            <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setInclSubtree(true) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Gesamte Struktur</option>
              {visibleUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {hasSubtree && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Unterstruktur</label>
              <button onClick={() => setInclSubtree(p => !p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition ${inclSubtree ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${inclSubtree ? 'border-white' : 'border-gray-400'}`}>
                  {inclSubtree && <span className="text-white text-xs">✓</span>}
                </span>
                Inkl. Unterstruktur
              </button>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Von</label>
            <div className="flex gap-1">
              <select value={vonMonat} onChange={e => setVonMonat(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONATE.map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={vonJahr} onChange={e => setVonJahr(parseInt(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {JAHRE.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bis</label>
            <div className="flex gap-1">
              <select value={bisMonat} onChange={e => setBisMonat(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONATE.map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={bisJahr} onChange={e => setBisJahr(parseInt(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {JAHRE.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          {relevanteZeilen.slice(0, 3).map(({ name }, i) => (
            <div key={name} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className={`text-3xl font-bold ${i === 0 ? 'text-blue-600' : i === 1 ? 'text-green-600' : 'text-purple-600'}`}>
                {total(name)}
              </div>
              <div className="text-xs text-gray-500 mt-1">{name} gesamt</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-gray-700">Aktivitäten-Entwicklung</h3>
            {renderLegendButtons(aktivitaetenZeilen, LINE_COLORS)}
          </div>
          {aktivitaetenData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={aktivitaetenData}>
                <XAxis dataKey="name" tick={{fontSize:10}} />
                <YAxis tick={{fontSize:11}} />
                <Tooltip />
                {aktivitaetenZeilen.map((z, i) => (
                  <Line key={z} type="monotone" dataKey={z}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2} dot hide={!!hiddenLines[z]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {einheitenZeile && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold text-gray-700">Einheiten-Entwicklung</h3>
              {renderLegendButtons([einheitenZeile], ['#7c3aed'])}
            </div>
            {einheitenData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={einheitenData}>
                  <XAxis dataKey="name" tick={{fontSize:10}} />
                  <YAxis tick={{fontSize:11}} />
                  <Tooltip />
                  <Line type="monotone" dataKey={einheitenZeile}
                    stroke="#7c3aed" strokeWidth={2} dot hide={!!hiddenLines[einheitenZeile]} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
