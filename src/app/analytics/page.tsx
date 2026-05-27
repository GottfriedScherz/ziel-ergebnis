'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

export default function Analytics() {
  const [profile, setProfile] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('me')
  const [berichte, setBerichte] = useState<any[]>([])
  const [eintraege, setEintraege] = useState<any[]>([])
  const [filterMonat, setFilterMonat] = useState('alle')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof) { router.push('/login'); return }
      setProfile(prof)
      if (prof.is_admin) {
        const { data: allUsers } = await supabase.from('profiles').select('id, name').order('name')
        setUsers(allUsers || [])
      } else {
        const { data: team } = await supabase.from('profiles').select('id, name').eq('betreuer_id', prof.id)
        setUsers([{ id: prof.id, name: 'Ich selbst' }, ...(team || [])])
      }
      setSelectedUser(session.user.id)
    })
  }, [router])

  useEffect(() => {
    if (!selectedUser || !profile) return
    const supabase = createClient()
    const uid = selectedUser === 'me' ? profile.id : selectedUser
    supabase.from('berichte').select('*').eq('user_id', uid).order('jahr').then(({ data }) => {
      setBerichte(data || [])
    })
    supabase.from('eintraege').select('*, berichte!inner(user_id, monat, woche, jahr)').eq('berichte.user_id', uid).then(({ data }) => {
      setEintraege(data || [])
    })
  }, [selectedUser, profile])

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  // Build chart data per week
  const chartData = berichte
    .filter(b => filterMonat === 'alle' || b.monat === filterMonat)
    .map(b => {
      const be = eintraege.filter((e: any) => e.berichte?.monat === b.monat && e.berichte?.woche === b.woche)
      const sum = (zeile: string, field: 'vereinbart'|'stattgefunden') => be.filter((e:any) => e.zeile === zeile).reduce((s:number,e:any) => s+(e[field]||0), 0)
      return {
        name: `${b.monat.slice(0,3)} ${b.woche.replace('Woche ','')}`,
        'Beratungen (vereinb.)': sum('Beratungen Neukunden','vereinbart'),
        'Beratungen (stattgef.)': sum('Beratungen Neukunden','stattgefunden'),
        'Abschlüsse': sum('Abschlüsse','stattgefunden'),
        'Einheiten': sum('Einheiten','stattgefunden'),
        'Empfehlungen': sum('Empfehlungen','stattgefunden'),
      }
    })

  const eeData = berichte
    .filter(b => filterMonat === 'alle' || b.monat === filterMonat)
    .map(b => ({
      name: `${b.monat.slice(0,3)} ${b.woche.replace('Woche ','')}`,
      'EE Ziel': b.ee_monat_ziel || 0,
      'EE Stand': b.ee_monat_stand || 0,
      'VIP Ziel': b.vip_monat_ziel || 0,
      'VIP Stand': b.vip_monat_stand || 0,
    }))

  const totalAbschluss = eintraege.filter((e:any) => e.zeile === 'Abschlüsse').reduce((s:number,e:any) => s+(e.stattgefunden||0),0)
  const totalEinheiten = eintraege.filter((e:any) => e.zeile === 'Einheiten').reduce((s:number,e:any) => s+(e.stattgefunden||0),0)
  const totalBeratungen = eintraege.filter((e:any) => e.zeile === 'Beratungen Neukunden').reduce((s:number,e:any) => s+(e.stattgefunden||0),0)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📈 Analytics</h1>
        <div className="w-20" />
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 flex gap-3 flex-wrap items-end">
          {users.length > 1 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Person</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
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

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Beratungen gesamt', value: totalBeratungen, color: 'blue' },
            { label: 'Abschlüsse gesamt', value: totalAbschluss, color: 'green' },
            { label: 'Einheiten gesamt', value: totalEinheiten, color: 'purple' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className={`text-3xl font-bold text-${k.color}-600`}>{k.value}</div>
              <div className="text-xs text-gray-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Line Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-4">Aktivitäten-Entwicklung</h3>
          {chartData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{fontSize:11}} />
                <YAxis tick={{fontSize:11}} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Beratungen (stattgef.)" stroke="#2a6fa8" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Abschlüsse" stroke="#27500A" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Einheiten" stroke="#7c3aed" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Empfehlungen" stroke="#d97706" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar Chart EE + VIP */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Eigen-Einheiten & VIP — Ziel vs. Stand</h3>
          {eeData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={eeData}>
                <XAxis dataKey="name" tick={{fontSize:11}} />
                <YAxis tick={{fontSize:11}} />
                <Tooltip />
                <Legend />
                <Bar dataKey="EE Ziel" fill="#d8edbe" stroke="#27500A" strokeWidth={1} />
                <Bar dataKey="EE Stand" fill="#27500A" />
                <Bar dataKey="VIP Ziel" fill="#c5def2" stroke="#0C447C" strokeWidth={1} />
                <Bar dataKey="VIP Stand" fill="#0C447C" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
