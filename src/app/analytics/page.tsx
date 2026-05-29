'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const LINE_COLORS = ['#2a6fa8','#27500A','#d97706','#dc2626','#0891b2','#65a30d','#7c3aed','#db2777']

export default function Analytics() {
  const [profile, setProfile] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [visibleUsers, setVisibleUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [inclSubtree, setInclSubtree] = useState(true)
  const [berichte, setBerichte] = useState<any[]>([])
  const [eintraege, setEintraege] = useState<any[]>([])
  const [filterMonat, setFilterMonat] = useState('alle')
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({})
  const [formularZeilen, setFormularZeilen] = useState<string[]>([])
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
      setFormularZeilen(zeilen.map((z: any) => z.name))
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
    const b = await dbQuery('berichte', `${idFilter}&select=*&order=jahr,monat`) || []
    setBerichte(b)
    if (b.length > 0) {
      const bIds = b.map((x: any) => x.id)
      const e = await dbQuery('eintraege', `bericht_id=in.(${bIds.join(',')})&select=*`) || []
      setEintraege(e)
    } else {
      setEintraege([])
    }
  }

  useEffect(() => { if (profile && visibleUsers.length > 0) loadData() }, [filterMonat])

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  const filteredBerichte = berichte.filter(b => filterMonat === 'alle' || b.monat === filterMonat)
  const aktivitaetenZeilen = formularZeilen.filter(z => z !== 'Einheiten')
  const einheitenZeile = formularZeilen.includes('Einheiten') ? 'Einheiten' : null

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
    .filter(e => filterMonat === 'alle' || berichte.find(b => b.id === e.bericht_id && b.monat === filterMonat))
    .filter(e => e.zeile === zeile)
    .reduce((s, e: any) => s + (e.stattgefunden || 0), 0)

  function toggleLine(key: string) {
    setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const hasSubtree = selectedUser !== 'all' && getSubtreeIds(selectedUser, allUsers).length > 0

  function renderLegendButtons(zeilen: string[], colors: string[]) {
    return (
      <div className="flex gap-2 flex-wrap">
        {zeilen.map((z, i) => (
          <button key={z} onClick={() => toggleLine(z)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${hiddenLines[z] ? 'opacity-40 bg-gray-100 border-gray-200' : 'bg-white border-gray-300'}`}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{backgroundColor: colors[i % colors.length]}} />
            {z}
          </button>
        ))}
      </div>
    )
  }

  const eeLines = [
    { key: 'EE Stand', color: '#27500A' },
    { key: 'VIP Stand', color: '#0C447C' },
  ]

  const eeData = filteredBerichte.map(b => {
    const user = allUsers.find((u: any) => u.id === b.user_id)
    return {
      name: `${b.monat.slice(0,3)} W${b.woche.replace('Woche ', '')}${selectedUser === 'all' ? ` (${user?.name?.split(' ')[0] || ''})` : ''}`,
      'EE Stand': b.ee_monat_stand || 0,
      'VIP Stand': b.vip_monat_stand || 0,
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📈 Analytics</h1>
        <div className="w-20" />
      </nav>
      <div className="max-w-5xl mx-auto px-4 py-6">

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 flex gap-3 flex-wrap items-end">
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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monat</label>
            <select value={filterMonat} onChange={e => setFilterMonat(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="alle">Alle Monate</option>
              {MONATE.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          {[['Beratungen Neukunden','Beratungen','blue'],['Abschlüsse','Abschlüsse','green'],['Einheiten','Einheiten','purple']].map(([zeile,label,color]) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className={`text-3xl font-bold text-${color}-600`}>{total(zeile)}</div>
              <div className="text-xs text-gray-500 mt-1">{label} gesamt</div>
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
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
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

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-gray-700">Eigen-Einheiten & VIP — Stand</h3>
            {renderLegendButtons(eeLines.map(l => l.key), eeLines.map(l => l.color))}
          </div>
          {eeData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={eeData}>
                <XAxis dataKey="name" tick={{fontSize:10}} />
                <YAxis tick={{fontSize:11}} />
                <Tooltip />
                {eeLines.map(l => (
                  <Line key={l.key} type="monotone" dataKey={l.key}
                    stroke={l.color} strokeWidth={2} dot hide={!!hiddenLines[l.key]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  )
}
