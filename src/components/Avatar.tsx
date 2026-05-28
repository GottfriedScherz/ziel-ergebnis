'use client'
import { useState, useRef } from 'react'

interface AvatarProps {
  url?: string | null
  name: string
  size?: number
  editable?: boolean
  userId?: string
  onUpdate?: (url: string) => void
}

export default function Avatar({ url, name, size = 40, editable = false, userId, onUpdate }: AvatarProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const displayUrl = preview || url

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    // Preview
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('userId', userId)

    const res = await fetch('/api/upload-avatar', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)

    if (data.avatarUrl && onUpdate) onUpdate(data.avatarUrl)
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {displayUrl ? (
        <img src={displayUrl} alt={name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
          className="border-2 border-gray-200" />
      ) : (
        <div style={{ width: size, height: size, borderRadius: '50%', fontSize: size * 0.35 }}
          className="bg-blue-100 text-blue-700 flex items-center justify-center font-semibold border-2 border-gray-200">
          {initials}
        </div>
      )}
      {editable && (
        <>
          <button onClick={() => inputRef.current?.click()}
            style={{ width: size * 0.38, height: size * 0.38, bottom: -2, right: -2 }}
            className="absolute bg-blue-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-700 transition border-2 border-white"
            title="Foto ändern">
            {uploading ? '⏳' : '📷'}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </>
      )}
    </div>
  )
}
