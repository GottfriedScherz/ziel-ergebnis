import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { newEmail, newPassword, accessToken } = await req.json()

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

  if (!accessToken) return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })

  const body: any = {}
  if (newEmail) body.email = newEmail
  if (newPassword) body.password = newPassword

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'Nichts zu ändern.' }, { status: 400 })
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.message || 'Fehler beim Aktualisieren.' }, { status: 400 })
  }

  // Update email in profiles table too
  if (newEmail && data.id) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ email: newEmail })
    })
  }

  return NextResponse.json({ success: true })
}
