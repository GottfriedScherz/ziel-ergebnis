'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'

interface Profile { id: string; name: string; email: string; karrierestufe: number; is_admin: boolean; betreuer_id: string | null; avatar_url?: string | null }
interface FormZeile { id: string; name: string; reihenfolge: number; stufe_min: number; aktiv: boolean; vm_feld: string | null }
interface AuthStatus { id: string; confirmed: boolean; last_sign_in: string | null }

function UserAvatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  if (url) return <img src={url} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} className="border-2 border-gray-200" />
  return <div style={{width:size,height:size,borderRadius:'50%',fontSize:size*0.35}} className="bg-blue-100 text-blue-700 flex items-center justify-center font-semibold border-2 border-gray-200">{initials}</div>
}

const VM_FELD_OPTIONS = [
  { value: '', label: '— kein VM-Feld —' },
  { value: 'mg', label: 'Marktgespräche (VM)' },
  { value: 'analysen', label: 'Analysen (VM)' },
  { value: 'ansprache', label: 'Ansprache auf Beruf / Einladungen (VM)' },
]

export default function Admin() {
  const [profile, setProfile] = useState<any>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [authStatus, setAuthStatus] = useState<Record<string, AuthStatus>>({})
  const [zeilen, setZeilen] = useState<FormZeile[]>([])
  const [zeilenEdits, setZeilenEdits] = useState<Record<string, string>>({})
  const [savingZeilen, setSavingZeilen] = useState(false)
  const [tab, setTab] = useState<'users'|'form'|'neuer'>('users')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newStufe, setNewStufe] = useState(1)
  const [newBetreuer, setNewBetreuer] = useState('')
  const [newZeile, setNewZeile] = useState('')
  const [newStufeMin, setNewStufeMin] = useState(1)
  const [newVmFeld, setNewVmFeld] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [resendingId, setResendingId] = useState<string|null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(async data => {
      const prof = data?.[0]
      if (!prof?.is_admin) { router.push('/dashboard'); return }
      setProfile(prof)
      dbQuery('profiles', 'select=*&order=name').then(u => setUsers(u || []))
      dbQuery('formular_zeilen', 'select=*&order=reihenfolge').then(z => {
        setZeilen(z || [])
        const edits: Record<string, string> = {}
        ;(z || []).forEach((row: FormZeile) => { edits[row.id] = row.name })
        setZeilenEdits(edits)
      })
      const authRes = await fetch('/api/admin-zeile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_auth_users' })
      })
      const authData = await authRes.json()
      if (authData.users) {
        const map: Record<string, AuthStatus> = {}
        authData.users.forEach((u: AuthStatus) => { map[u.id] = u })
        setAuthStatus(map)
      }
    })
  }, [router])

  function showMsg(text: string, type: 'ok'|'err'|'info' = 'info') {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  async function adminApi(url: string, body: any) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  }

  async function updateUser(id: string, field: string, value: any) {
    const current = users.find(u => u.id === id)
    if (!current || (current as any)[field] === value) return
    const data = await adminApi('/api/admin-zeile', { action: 'update_user', id, field, value })
    if (!data.error) setUsers(prev => prev.map(u => u.id === id ? { ...u, [field]: value } : u))
    else showMsg('Fehler beim Speichern', 'err')
  }

  async function deleteUser(id: string, name: string) {
    const hatUnterstruktur = users.some(u => u.betreuer_id === id)
    if (hatUnterstruktur) {
      showMsg(`"${name}" kann nicht gelöscht werden: Bitte zuerst die betreuten Partner einem anderen Betreuer zuordnen.`, 'err')
      return
    }
    if (!confirm(`Wirklich "${name}" löschen? Alle Berichte werden ebenfalls gelöscht!`)) return
    setDeletingId(id)
    const data = await adminApi('/api/delete-user', { userId: id })
    setDeletingId(null)
    if (data.error) showMsg('Fehler: ' + data.error, 'err')
    else { setUsers(prev => prev.filter(u => u.id !== id)); showMsg(`${name} wurde gelöscht.`, 'ok') }
  }

  async function resendInvite(id: string, email: string, name: string) {
    setResendingId(id)
    const data = await adminApi('/api/resend-invite', { email, name })
    setResendingId(null)
    if (data.error) showMsg('Fehler: ' + data.error, 'err')
    else showMsg(`Einladung erneut an ${email} gesendet ✓`, 'ok')
  }

  async function updateZeileProp(id: string, field: string, value: any) {
    await adminApi('/api/admin-zeile', { action: 'update', id, [field]: value })
    setZeilen(prev => prev.map(z => z.id === id ? { ...z, [field]: value } : z))
  }

  async function deleteZeile(id: string, name: string) {
    if (!confirm(`Zeile "${name}" wirklich löschen?`)) return
    await adminApi('/api/admin-zeile', { action: 'delete_zeile', id })
    setZeilen(prev => prev.filter(z => z.id !== id))
    setZeilenEdits(prev => { const e = {...prev}; delete e[id]; return e })
    showMsg('Zeile gelöscht ✓', 'ok')
  }

  async function saveZeilen() {
    setSavingZeilen(true)
    for (const z of zeilen) {
      const newNameVal = zeilenEdits[z.id] ?? z.name
      if (newNameVal !== z.name) {
        await adminApi('/api/admin-zeile', { action: 'update', id: z.id, name: newNameVal })
        await adminApi('/api/admin-zeile', { action: 'update_eintraege_zeile', name: z.name, aktiv: newNameVal })
      }
    }
    setZeilen(prev => prev.map(z => ({ ...z, name: zeilenEdits[z.id] ?? z.name })))
    setSavingZeilen(false)
    showMsg('Formular gespeichert ✓', 'ok')
  }

  async function addZeile() {
    if (!newZeile.trim()) return
    const maxOrd = Math.max(...zeilen.map(z => z.reihenfolge), 0)
    const result = await adminApi('/api/admin-zeile', {
      action: 'insert', name: newZeile, stufe_min: newStufeMin,
      reihenfolge: maxOrd + 1, vm_feld: newVmFeld || null
    })
    if (result.error) { showMsg('Fehler: ' + JSON.stringify(result.error), 'err'); return }
    if (result.data) {
      setZeilen(prev => [...prev, result.data])
      setZeilenEdits(prev => ({ ...prev, [result.data.id]: result.data.name }))
    }
    setNewZeile(''); setNewVmFeld('')
    showMsg('Zeile hinzugefügt ✓', 'ok')
  }

  async function createUser() {
    if (!newName || !newEmail) { showMsg('Bitte Name und E-Mail ausfüllen.', 'err'); return }
    setCreating(true)
    const data = await adminApi('/api/create-user', { name: newName, email: newEmail, karrierestufe: newStufe, betreuer_id: newBetreuer || null })
    setCreating(false)
    if (data.error) showMsg('Fehler: ' + data.error, 'err')
    else {
      showMsg('✓ Partner angelegt! Einladungsmail wurde verschickt.', 'ok')
      setNewName(''); setNewEmail(''); setNewStufe(1); setNewBetreuer('')
      dbQuery('profiles', 'select=*&order=name').then(u => setUsers(u || []))
    }
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
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab===t?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t==='users'?'👥 Nutzer':t==='form'?'📋 Formular':'➕ Neuer Partner'}
            </button>
          ))}
        </div>

        {msg && (
          <div className={`rounded-xl px-4 py-2 mb-4 text-sm font-medium ${
            msgType==='ok'?'bg-green-50 border border-green-200 text-green-700':
            msgType==='err'?'bg-red-50 border border-red-200 text-red-700':
            'bg-blue-50 border border-blue-200 text-blue-700'}`}>{msg}</div>
        )}

        {tab === 'users' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Planungsvariante</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Betreuer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase" title="Keine Wochenplanung erforderlich">Ausnahme</th>
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody>
                {users.map(u => {
                  const auth = authStatus[u.id]
                  return (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar url={u.avatar_url} name={u.name} size={36} />
                          <div>
                            <div className="text-sm font-medium text-gray-700">{u.name}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.karrierestufe} onChange={e => updateUser(u.id, 'karrierestufe', parseInt(e.target.value))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
                          <option value={1}>Planungsvariante VM</option>
                          <option value={2}>Planungsvariante VBA</option>
                          <option value={3}>Planungsvariante HB</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.betreuer_id || ''} onChange={e => updateUser(u.id, 'betreuer_id', e.target.value || null)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
                          <option value="">Kein Betreuer</option>
                          {users.filter(x => x.id !== u.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {auth ? (
                            auth.last_sign_in ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">✓ Aktiv</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">⏳ Einladung offen</span>
                            )
                          ) : <span className="text-xs text-gray-300">—</span>}
                          <button onClick={() => resendInvite(u.id, u.email, u.name)} disabled={resendingId === u.id}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 text-left">
                            {resendingId === u.id ? '...' : '↩ Zugang erneut senden'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={u.is_admin} onChange={e => updateUser(u.id, 'is_admin', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={!!u.planung_nicht_erforderlich} onChange={e => updateUser(u.id, 'planung_nicht_erforderlich', e.target.checked)} className="w-4 h-4 accent-orange-500" title="Keine Wochenplanung erforderlich" />
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== profile.id && (
                          <button onClick={() => deleteUser(u.id, u.name)} disabled={deletingId === u.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40">
                            {deletingId === u.id ? '...' : 'Löschen'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'form' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
                Stufen-Logik: VM sieht Stufe 1+, VBA sieht Stufe 2+, HB sieht alle — VM-Feld: Welche Spalte zählt in der VM-Wochenplanung dazu
              </div>
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zeile</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sichtbar ab</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <span title="Wird dem Betreuer in folgender Kategorie angerechnet" className="cursor-help border-b border-dotted border-gray-400">VM-Feld</span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aktiv</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {zeilen.map(z => (
                    <tr key={z.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input value={zeilenEdits[z.id] ?? z.name}
                          onChange={e => setZeilenEdits(prev => ({ ...prev, [z.id]: e.target.value }))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={z.stufe_min} onChange={e => updateZeileProp(z.id, 'stufe_min', parseInt(e.target.value))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
                          <option value={1}>VM, VBA & HB</option>
                          <option value={2}>VBA & HB</option>
                          <option value={3}>Nur HB</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select value={z.vm_feld || ''} onChange={e => updateZeileProp(z.id, 'vm_feld', e.target.value || null)}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
                          {VM_FELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={z.aktiv} onChange={e => updateZeileProp(z.id, 'aktiv', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteZeile(z.id, z.name)} className="text-xs text-red-500 hover:text-red-700 font-medium">Löschen</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={saveZeilen} disabled={savingZeilen}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {savingZeilen ? 'Wird gespeichert...' : '💾 Zeilennamen speichern'}
            </button>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Neue Zeile hinzufügen</h3>
              <div className="flex gap-2 flex-wrap">
                <input value={newZeile} onChange={e => setNewZeile(e.target.value)} placeholder="Zeilenname"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newStufeMin} onChange={e => setNewStufeMin(parseInt(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value={1}>VM, VBA & HB</option>
                  <option value={2}>VBA & HB</option>
                  <option value={3}>Nur HB</option>
                </select>
                <select value={newVmFeld} onChange={e => setNewVmFeld(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {VM_FELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={addZeile} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">Hinzufügen</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'neuer' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-700 mb-1">Neuen Partner anlegen</h3>
            <p className="text-sm text-gray-400 mb-4">Der Partner erhält automatisch eine Einladungsmail und setzt sein Passwort selbst.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Vor- und Nachname"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">E-Mail</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@beispiel.at"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Planungsvariante</label>
                  <select value={newStufe} onChange={e => setNewStufe(parseInt(e.target.value))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={1}>Planungsvariante VM</option>
                    <option value={2}>Planungsvariante VBA</option>
                    <option value={3}>Planungsvariante HB</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Betreuer</label>
                  <select value={newBetreuer} onChange={e => setNewBetreuer(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Kein Betreuer</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createUser} disabled={creating}
                className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                {creating ? 'Wird angelegt...' : '✉️ Partner anlegen & Einladung senden'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
