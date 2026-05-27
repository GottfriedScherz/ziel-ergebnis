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

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true })
  })

  const authData = await authRes.json()

  if (!authRes.ok) {
    // Map common Supabase error codes to German messages
    const msg = authData.msg || authData.message || authData.error_description || ''
    let errMsg = 'Fehler beim Anlegen des Nutzers.'
    if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered') || authData.code === 'email_exists') {
      errMsg = 'Diese E-Mail-Adresse ist bereits registriert.'
    } else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('weak')) {
      errMsg = 'Passwort zu schwach. Bitte mindestens 8 Zeichen, Groß- und Kleinbuchstaben sowie eine Zahl verwenden.'
    } else if (msg.toLowerCase().includes('invalid') && msg.toLowerCase().includes('email')) {
      errMsg = 'Ungültige E-Mail-Adresse.'
    } else if (msg) {
      errMsg = msg
    }
    return NextResponse.json({ error: errMsg }, { status: 400 })
  }

  const userId = authData.id

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      id: userId, name, email,
      karrierestufe: parseInt(karrierestufe),
      is_admin: false,
      betreuer_id: betreuer_id || null,
    })
  })

  if (!profileRes.ok) {
    const profileErr = await profileRes.json()
    return NextResponse.json({ error: 'Nutzer angelegt, aber Profil fehlgeschlagen: ' + (profileErr.message || '') }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId })
}
