import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, password, karrierestufe, betreuer_id } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, E-Mail und Passwort sind erforderlich.' }, { status: 400 })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

  // Try admin API first, fall back to signup
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
  console.log('Auth status:', authRes.status, 'Body:', authText)

  if (!authRes.ok) {
    // Try signup endpoint as fallback
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
    console.log('Signup status:', signupRes.status, 'Body:', signupText)

    if (!signupRes.ok) {
      let errMsg = 'Fehler beim Anlegen des Nutzers.'
      try {
        const d = JSON.parse(signupText)
        const msg = d.msg || d.message || d.error_description || ''
        if (msg.toLowerCase().includes('already')) errMsg = 'Diese E-Mail ist bereits registriert.'
        else if (msg.toLowerCase().includes('password')) errMsg = 'Passwort zu schwach (min. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl).'
        else if (msg) errMsg = msg
      } catch(e) {}
      return NextResponse.json({ error: errMsg }, { status: 400 })
    }

    const signupData = JSON.parse(signupText)
    const userId = signupData.id || signupData.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Nutzer angelegt aber ID nicht gefunden. Bitte in Supabase Profil manuell anlegen.' }, { status: 400 })
    }

    // Create profile with service key
    await createProfile(SUPABASE_URL, SERVICE_KEY, userId, name, email, karrierestufe, betreuer_id)
    return NextResponse.json({ success: true, userId })
  }

  const authData = JSON.parse(authText)
  const userId = authData.id

  await createProfile(SUPABASE_URL, SERVICE_KEY, userId, name, email, karrierestufe, betreuer_id)
  return NextResponse.json({ success: true, userId })
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
