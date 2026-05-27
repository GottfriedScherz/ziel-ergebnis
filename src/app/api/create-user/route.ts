import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, password, karrierestufe, betreuer_id } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, E-Mail und Passwort sind erforderlich.' }, { status: 400 })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

  if (!SERVICE_KEY) {
    return NextResponse.json({ error: 'Service Key nicht konfiguriert.' }, { status: 500 })
  }

  // 1. Create auth user
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    })
  })

  const authText = await authRes.text()
  console.log('Auth response status:', authRes.status)
  console.log('Auth response body:', authText)

  if (!authRes.ok) {
    let errMsg = 'Fehler beim Anlegen des Nutzers.'
    try {
      const authData = JSON.parse(authText)
      errMsg = authData.msg || authData.message || authData.error_description || errMsg
    } catch(e) {}
    return NextResponse.json({ error: errMsg }, { status: 400 })
  }

  const authData = JSON.parse(authText)
  const userId = authData.id

  // 2. Create profile
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      id: userId,
      name,
      email,
      karrierestufe: parseInt(karrierestufe),
      is_admin: false,
      betreuer_id: betreuer_id || null,
    })
  })

  if (!profileRes.ok) {
    const profileErr = await profileRes.json()
    console.log('Profile error:', profileErr)
    return NextResponse.json({ error: profileErr.message || 'Profil konnte nicht erstellt werden.' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId })
}
