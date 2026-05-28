import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const userId = formData.get('userId') as string

  if (!file || !userId) return NextResponse.json({ error: 'Datei oder User fehlt.' }, { status: 400 })

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

  const ext = file.name.split('.').pop()
  const fileName = `${userId}.${ext}`
  const bytes = await file.arrayBuffer()

  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: bytes,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return NextResponse.json({ error: 'Upload fehlgeschlagen: ' + err }, { status: 400 })
  }

  const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}?t=${Date.now()}`

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ avatar_url: avatarUrl })
  })

  return NextResponse.json({ success: true, avatarUrl })
}
