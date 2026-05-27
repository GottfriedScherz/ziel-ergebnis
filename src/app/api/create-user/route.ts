import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, password, karrierestufe, betreuer_id } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, E-Mail und Passwort sind erforderlich.' }, { status: 400 })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true })
  })

  const authText = await authRes.text()

  if (!authRes.ok) {
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ email, password })
    })

    const signupText = await signupRes.text()

    if (!signupRes.ok) {
      let errMsg = 'Fehler beim Anlegen des Nutzers.'
      try {
        const d = JSON.parse(signupText)
        const msg = (d.msg || d.message || d.error_description || '').toLowerCase()
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exist')) {
          errMsg = 'Diese E-Mail-Adresse ist bereits registriert.'
        } else if (msg.includes('password') || msg.includes('weak')) {
          errMsg = 'Passwort zu schwach (mindestens 6 Zeichen).'
        } else if (msg.includes('invalid') && msg.includes('email')) {
          errMsg = 'Ungültige E-Mail-Adresse.'
        } else if (d.msg || d.message) {
          errMsg = d.msg || d.message
        }
      } catch(e) {}
      // 422 is almost always duplicate email
      if (signupRes.status === 422) errMsg = 'Diese E-Mail-Adresse ist bereits registriert.'
      return NextResponse.json({ error: errMsg }, { status: 400 })
    }

    const signupData = JSON.parse(signupText)
    const userId = signupData.id || signupData.user?.id
    if (!userId) return NextResponse.json({ error: 'Nutzer angelegt aber ID nicht gefunden.' }, { status: 400 })
    await createProfile(SUPABASE_URL, SERVICE_KEY, userId, name, email, karrierestufe, betreuer_id)
    return NextResponse.json({ success: true, userId })
  }

  // Also handle 422 from admin endpoint
  if (authRes.status === 422) {
    return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 400 })
  }

  const authData = JSON.parse(authText)
  await createProfile(SUPABASE_URL, SERVICE_KEY, authData.id, name, email, karrierestufe, betreuer_id)
  return NextResponse.json({ success: true, userId: authData.id })
}

async function createProfile(url: string, key: string, userId: string, name: string, email: string, karrierestufe: any, betreuer_id: any) {
  const res = await fetch(`${url}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      id: userId, name, email,
      karrierestufe: parseInt(karrierestufe),
      is_admin: false,
      betreuer_id: betreuer_id || null,
    })
  })
  if (!res.ok) console.error('Profile creation failed:', await res.text())
}
