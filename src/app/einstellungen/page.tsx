'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { dbQuery, getToken, getUser } from '@/lib/supabase'
import Link from 'next/link'
import Cropper from 'react-easy-crop'

async function getCroppedImg(imageSrc: string, croppedAreaPixels: any): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.clip()
  ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, size, size)
  return new Promise(res => canvas.toBlob(blob => res(blob!), 'image/jpeg', 0.9))
}

function UserAvatar({ url, name, size = 72, editable = false, userId, onUpdate }: {
  url?: string | null; name: string; size?: number; editable?: boolean; userId?: string; onUpdate?: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string|null>(null)
  const [cropSrc, setCropSrc] = useState<string|null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const displayUrl = preview || url

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const onCropComplete = useCallback((_: any, pixels: any) => { setCroppedAreaPixels(pixels) }, [])

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels || !userId) return
    setUploading(true); setCropSrc(null)
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      setPreview(URL.createObjectURL(blob))
      const fd = new FormData()
      fd.append('file', file); fd.append('userId', userId)
      const res = await fetch('/api/upload-avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.avatarUrl && onUpdate) onUpdate(data.avatarUrl)
    } catch (err) { console.error(err) }
    setUploading(false)
  }

  return (
    <>
      <div className="relative" style={{width:size,height:size}}>
        {displayUrl
          ? <img src={displayUrl} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover'}} className="border-2 border-gray-200" />
          : <div style={{width:size,height:size,borderRadius:'50%',fontSize:size*0.35}} className="bg-blue-100 text-blue-700 flex items-center justify-center font-semibold border-2 border-gray-200">{initials}</div>
        }
        {editable && (
          <>
            <button onClick={() => inputRef.current?.click()}
              style={{width:Math.max(22,size*0.38),height:Math.max(22,size*0.38),bottom:-2,right:-2}}
              className="absolute bg-blue-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-700 transition border-2 border-white"
              title="Foto ändern">
              {uploading ? '⏳' : '📷'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </>
        )}
      </div>
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{width:360,maxWidth:'95vw'}}>
            <div className="relative bg-black" style={{height:320}}>
              <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
                onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">Zoom</span>
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-blue-600" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCropSrc(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Abbrechen</button>
                <button onClick={handleCropConfirm} className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition">Übernehmen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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
    if (newPw && newPw !== confirmPw) { setMsg('Passwörter stimmen nicht überein.'); setMsgType('err'); return }
    if (newPw && newPw.length < 6) { setMsg('Passwort muss mindestens 6 Zeichen haben.'); setMsgType('err'); return }
    if (!newEmail && !newPw) { setMsg('Bitte mindestens ein Feld ausfüllen.'); setMsgType('err'); return }
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
      setMsg('Erfolgreich gespeichert! ✓'); setMsgType('ok')
      setNewEmail(''); setNewPw(''); setConfirmPw('')
      if (newEmail) {
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
            <UserAvatar url={avatarUrl} name={profile.name} size={72} editable userId={profile.id} onUpdate={url => setAvatarUrl(url)} />
            <div>
              <h2 className="font-semibold text-gray-700">{profile.name}</h2>
              <p className="text-sm text-gray-400">Aktuelle E-Mail: <span className="text-gray-600 font-medium">{profile.email}</span></p>
              <p className="text-xs text-green-600 mt-1">✓ Foto wird sofort gespeichert</p>
            </div>
          </div>
          <hr className="border-gray-100 my-2" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">E-Mail &amp; Passwort ändern</p>
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
