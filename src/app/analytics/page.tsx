'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

export default function Analytics() {
  const [profile, setProfile] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [berichte, setBerichte] = useState<any[]>([])
  const [eintraege, setEintraege] = useState<any[]>([])
  const [filterMonat, setFilterMonat] = useState('alle')
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(data => {
      const prof = data?.[0]
      if (!prof) { router.push('/login'); return }
      setProfile(prof)
      setSelectedUser(user.id)
      if (prof.is_admin) {
        dbQuery('profiles', 'select=id,name&order=name').then(u => setUsers(u || []))
      } else {
        dbQuery('profiles', `betreuer_id=eq.${user.id}&select=id,name`).then(team => {
          setUsers([{ id: user.id, name: 'Ich selbst' }, ...(team || [])])
        })
      }
    })
  }, [router])

  useEffect(() => {
    if (!selectedUser) return
    dbQuery('berichte', `user_id=eq.${selectedUser}&select=*&order=jahr,monat`).then(d => setBerichte(d || []))
    dbQuery('eintraege', `select=*,berichte!inner(user_id,monat,woche,jahr)&berichte.user_id=eq.${selectedUser}`).then(d => setEintraege(d || []))
  }, [selectedUser])

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  const chartData = berichte
    .filter(b => filterMonat === 'alle' || b.monat === filterMonat)
    .map(b => {
      const be = eintraege.filter((e: any) => e.berichte?.monat === b.monat && e.berichte?.woche === b.woche)
      const sum = (zeile: string, field: string) => be.filter((e:any) => e.zeile === zeile).reduce((s:number,e:any) => s+(e[field]||0), 0)
      return {
        name: `${b.monat.slice(0,3)} W${b.woche.replace('Woche ','')}`,
        'Beratungen': sum('Beratungen Neukunden','stattgefunden'),
        'Abschlüsse': sum('Abschlüsse','stattgefunden'),
        'Einheiten': sum('Einheiten','stattgefunden'),
        'Empfehlungen': sum('Empfehlungen','stattgefunden'),
      }
    })

  const eeData = berichte
    .filter(b => filterMonat === 'alle' || b.monat === filterMonat)
    .map(b => ({
      name: `${b.monat.slice(0,3)} W${b.woche.replace('Woche ','')}`,
      'EE Ziel': b.ee_monat_ziel || 0, 'EE Stand': b.ee_monat_stand || 0,
      'VIP Ziel': b.vip_monat_ziel || 0, 'VIP Stand': b.vip_monat_stand || 0,
    }))

  const total = (zeile: string) => eintraege.filter((e:any) => e.zeile === zeile).reduce((s:number,e:any) => s+(e.stattgefunden||0),0)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">📈 Analytics</h1>
        <div className="w-20" />
      </nav>
      <div className="max-w-5xl mx-auto px-4 py-6">
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
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[['Beratungen','blue'],['Abschlüsse','green'],['Einheiten','purple']].map(([label, color]) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <div className={`text-3xl font-bold text-${color}-600`}>{total(label === 'Beratungen' ? 'Beratungen Neukunden' : label)}</div>
              <div className="text-xs text-gray-500 mt-1">{label} gesamt</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <h3 className="font-semibold text-gray-700 mb-4">Aktivitäten-Entwicklung</h3>
          {chartData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="Beratungen" stroke="#2a6fa8" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Abschlüsse" stroke="#27500A" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Einheiten" stroke="#7c3aed" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Empfehlungen" stroke="#d97706" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Eigen-Einheiten & VIP — Ziel vs. Stand</h3>
          {eeData.length === 0 ? <p className="text-gray-400 text-sm">Noch keine Daten vorhanden.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={eeData}>
                <XAxis dataKey="name" tick={{fontSize:11}} /><YAxis tick={{fontSize:11}} />
                <Tooltip /><Legend />
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
