'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser, logout } from '@/lib/supabase'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

export default function Einstellungen() {
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string|null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'>('ok')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return }
    const user = getUser()
    dbQuery('profiles', `id=eq.${user.id}&select=*`).then(data => {
      if (data?.[0]) { setProfile(data[0]); setAvatarUrl(data[0].avatar_url || null) }
      else router.push('/login')
    })
  }, [router])

  async function handleSave() {
    if (newPw && newPw !== confirmPw) {
      setMsg('Passwörter stimmen nicht überein.'); setMsgType('err'); return
    }
    if (newPw && newPw.length < 6) {
      setMsg('Passwort muss mindestens 6 Zeichen haben.'); setMsgType('err'); return
    }
    if (!newEmail && !newPw) {
      setMsg('Bitte mindestens ein Feld ausfüllen.'); setMsgType('err'); return
    }
    setSaving(true)
    const res = await fetch('/api/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail: newEmail || undefined, newPassword: newPw || undefined, accessToken: getToken() })
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setMsg(data.error); setMsgType('err') }
    else {
      setMsg('Erfolgreich gespeichert! ✓')
      setMsgType('ok')
      setNewEmail(''); setNewPw(''); setConfirmPw('')
      if (newEmail) {
        // Update local storage
        const user = getUser()
        if (user) { user.email = newEmail; localStorage.setItem('sb_user', JSON.stringify(user)) }
      }
    }
    setTimeout(() => setMsg(''), 3000)
  }

  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">Laden...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">← Dashboard</Link>
        <h1 className="font-bold text-gray-800">⚙️ Einstellungen</h1>
        <div className="w-20" />
      </nav>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <div className="flex items-center gap-4 mb-5">
            <Avatar url={avatarUrl} name={profile.name} size={72} editable userId={profile.id} onUpdate={url => setAvatarUrl(url)} />
            <div>
              <h2 className="font-semibold text-gray-700">{profile.name}</h2>
              <p className="text-sm text-gray-400">Aktuelle E-Mail: <span className="text-gray-600 font-medium">{profile.email}</span></p>
              <p className="text-xs text-gray-400 mt-1">Klicke auf das Foto-Symbol um dein Profilbild zu ändern</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Neue E-Mail-Adresse</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="Neue E-Mail (leer lassen = keine Änderung)" autoComplete="off"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Neues Passwort</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Neues Passwort (leer lassen = keine Änderung)" autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {newPw && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Passwort bestätigen</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Passwort wiederholen" autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {msg && (
              <div className={`rounded-xl px-4 py-2 text-sm font-medium ${msgType === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {msg}
              </div>
            )}
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Wird gespeichert...' : 'Änderungen speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
