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

  a
