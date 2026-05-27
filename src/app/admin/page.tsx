'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface Profile { id: string; name: string; email: string; karrierestufe: number; is_admin: boolean; betreuer_id: string | null }
interface FormZeile { id: string; name: string; reihenfolge: number; stufe_min: number; aktiv: boolean }

export default function Admin() {
  const [profile, setProfile] = useState<any>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [zeilen, setZeilen] = useState<FormZeile[]>([])
  const [tab, setTab] = useState<'users'|'form'|'neuer'>('users')
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newStufe, setNewStufe] = useState(1)
  const [newBetreuer, setNewBetreuer] = useState('')
  const [newZeile, setNewZeile] = useState('')
  const [newStufeMin, setNewStufeMin] = useState(1)
  const [msg, setMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof?.is_admin) { router.push('/dashboard'); return }
      setProfile(prof)
      const { data: u } = await supabase.from('profiles').select('*').order('name')
      setUsers(u || [])
      const { data: z } = await supabase.from('formular_zeilen').select('*').order('reihenfolge')
      setZeilen(z || [])
    })
  }, [router])

  async function updateUser(id: string, field: string, value: any) {
    const supabase = createClient()
    await supabase.from('profiles').update({ [field]: value }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u))
  }

  async function updateZeile(id: string, field: string, value: any) {
    const supabase = createClient()
    await supabase.from('formular_zeilen').update({ [field]: value }).eq('id', id)
    setZeilen(prev => prev.map(z => z.id === id ? { ...z, [field]: value } : z))
  }

  async function addZeile() {
    if (!newZeile.trim()) return
    const supabase = createClient()
    const maxOrd = Math.max(...zeilen.map(z => z.reihenfolge), 0)
    const { data } = await supabase.from('formular_zeilen').insert({ name: newZeile, reihenfolge: maxOrd + 1, stufe_min: newStufeMin, aktiv: true }).select().single()
    if (data) { setZeilen(prev => [...prev, data]); setNewZeile(''); setMsg('Zeile hinzugefügt ✓') }
    setTimeout(() => setMsg(''), 2000)
  }

  async function createUser() {
    if (!newEmail || !newName || !newPw) { setMsg('Bitte alle Felder ausfüllen.'); return }
    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.admin?.createUser
      ? { data: null, error: { message: 'Admin API nicht verfügbar im Browser' } }
      : { data: null, error: { message: 'Nutzer bitte direkt in Supabase Authentication anlegen.' } }
    setMsg('Neuen Nutzer bitte in Supabase → Authentication → Users anlegen, dann hier Stufe und Betreuer zuweisen.')
    setTimeout(() => setMsg(''), 8000)
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">⚙️ Admin</h1>
        <div className="w-20" />
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5">
          {(['users','form','neuer'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab===t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t === 'users' ? '👥 Nutzer' : t === 'form' ? '📋 Formular' : '➕ Neuer Nutzer'}
            </button>
          ))}
        </div>

        {msg && <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-4 text-sm text-blue-700">{msg}</div>}

        {tab === 'users' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stufe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Betreuer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admin</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{u.name}<br/><span className="text-xs text-gray-400">{u.email}</span></td>
                    <td className="px-4 py-3">
                      <select value={u.karrierestufe} onChange={e => updateUser(u.id, 'karrierestufe', parseInt(e.target.value))}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none">
                        <option value={1}>Stufe 1</option>
                        <option value={2}>Stufe 2</option>
                        <option value={3}>Stufe 3</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={u.betreuer_id || ''} onChange={e => updateUser(u.id, 'betreuer_id', e.target.value || null)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none">
                        <option value="">Kein Betreuer</option>
                        {users.filter(x => x.id !== u.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={u.is_admin} onChange={e => updateUser(u.id, 'is_admin', e.target.checked)}
                        className="w-4 h-4 accent-blue-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'form' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zeile</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ab Stufe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aktiv</th>
                </tr></thead>
                <tbody>
                  {zeilen.map(z => (
                    <tr key={z.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input value={z.name} onChange={e => updateZeile(z.id, 'name', e.target.value)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={z.stufe_min} onChange={e => updateZeile(z.id, 'stufe_min', parseInt(e.target.value))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none">
                          <option value={1}>Stufe 1+</option>
                          <option value={2}>Stufe 2+</option>
                          <option value={3}>Stufe 3</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={z.aktiv} onChange={e => updateZeile(z.id, 'aktiv', e.target.checked)}
                          className="w-4 h-4 accent-blue-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Neue Zeile hinzufügen</h3>
              <div className="flex gap-2 flex-wrap">
                <input value={newZeile} onChange={e => setNewZeile(e.target.value)} placeholder="Zeilenname"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newStufeMin} onChange={e => setNewStufeMin(parseInt(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                  <option value={1}>Stufe 1+</option>
                  <option value={2}>Stufe 2+</option>
                  <option value={3}>Stufe 3</option>
                </select>
                <button onClick={addZeile} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">Hinzufügen</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'neuer' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Neuen Nutzer anlegen</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-sm text-yellow-800">
              <strong>Schritt 1:</strong> Geh in Supabase → Authentication → Users → „Invite user" oder „Add user" und lege den Nutzer mit E-Mail + Passwort an.<br/>
              <strong>Schritt 2:</strong> Komm hier zurück und weise unter „Nutzer" die richtige Stufe und den Betreuer zu.
            </div>
            <p className="text-sm text-gray-500">Nach dem Anlegen in Supabase erscheint der Nutzer automatisch in der Nutzerliste sobald er sich einmal einloggt.</p>
          </div>
        )}
      </div>
    </div>
  )
}
