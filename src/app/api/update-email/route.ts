import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { newEmail, newPassword, accessToken, customToken } = await req.json()
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

  // Custom Token Flow
  if (customToken) {
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reset_tokens?token=eq.${customToken}&select=*`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    const tokens = await tokenRes.json()

    if (!tokens || tokens.length === 0)
      return NextResponse.json({ error: 'Token ungültig.' }, { status: 400 })

    const resetToken = tokens[0]

    if (resetToken.used)
      return NextResponse.json({ error: 'Token wurde bereits verwendet.' }, { status: 400 })

    if (new Date(resetToken.expires_at) < new Date())
      return NextResponse.json({ error: 'Token abgelaufen. Bitte neuen Link anfordern.' }, { status: 400 })

    const userRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(resetToken.email)}`,
      { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    const userData = await userRes.json()
    const userId = userData?.users?.[0]?.id

    if (!userId)
      return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 400 })

    const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ password: newPassword })
    })

    if (!updateRes.ok)
      return NextResponse.json({ error: 'Fehler beim Setzen des Passworts.' }, { status: 400 })

    await fetch(`${SUPABASE_URL}/rest/v1/reset_tokens?token=eq.${customToken}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=minimal',
  },
  body: JSON.stringify({ used: true })
})

// Direkt einloggen nach Passwort-Setzen
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  },
  body: JSON.stringify({ email: resetToken.email, password: newPassword })
})
const loginData = await loginRes.json()
if (loginRes.ok && loginData.access_token) {
  return NextResponse.json({
    success: true,
    accessToken: loginData.access_token,
    refreshToken: loginData.refresh_token,
    user: loginData.user
  })
}
return NextResponse.json({ success: true })
  }

  // Supabase Token Flow (bestehend)
  if (!accessToken)
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })

  const body: any = {}
  if (newEmail) body.email = newEmail
  if (newPassword) body.password = newPassword
  if (Object.keys(body).length === 0)
    return NextResponse.json({ error: 'Nichts zu ändern.' }, { status: 400 })

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
  if (!res.ok)
    return NextResponse.json({ error: data.message || 'Fehler beim Aktualisieren.' }, { status: 400 })

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
