'use client'
import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'

interface AvatarProps {
  url?: string | null
  name: string
  size?: number
  editable?: boolean
  userId?: string
  onUpdate?: (url: string) => void
}

async function getCroppedImg(imageSrc: string, croppedAreaPixels: any): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, size, size)
  return new Promise(res => canvas.toBlob(blob => res(blob!), 'image/jpeg', 0.9))
}

export default function Avatar({ url, name, size = 40, editable = false, userId, onUpdate }: AvatarProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const displayUrl = preview || url

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const onCropComplete = useCallback((_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels || !userId) return
    setUploading(true)
    setCropSrc(null)
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      setPreview(URL.createObjectURL(blob))
      const fd = new FormData()
      fd.append('file', file)
      fd.append('userId', userId)
      const res = await fetch('/api/upload-avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.avatarUrl && onUpdate) onUpdate(data.avatarUrl)
    } catch (err) {
      console.error('Crop/upload error:', err)
    }
    setUploading(false)
  }

  return (
    <>
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
              style={{ width: Math.max(22, size * 0.38), height: Math.max(22, size * 0.38), bottom: -2, right: -2 }}
              className="absolute bg-blue-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-blue-700 transition border-2 border-white"
              title="Foto ändern">
              {uploading ? '⏳' : '📷'}
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </>
        )}
      </div>

      {/* Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{width: 360, maxWidth: '95vw'}}>
            <div className="relative bg-black" style={{height: 320}}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">Zoom</span>
                <input type="range" min={1} max={3} step={0.01} value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="flex-1 accent-blue-600" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCropSrc(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  Abbrechen
                </button>
                <button onClick={handleCropConfirm}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition">
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
