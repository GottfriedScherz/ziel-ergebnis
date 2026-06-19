import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-Mail erforderlich.' }, { status: 400 })

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const RESEND_KEY = process.env.RESEND_API_KEY!
  const APP_URL = 'https://ziel-ergebnis.vercel.app'

  // 1. Prüfen ob E-Mail in profiles existiert
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=name,email`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      }
    }
  )
  const profiles = await profileRes.json()

  // Kein Fehler zurückgeben (Sicherheit — kein Hinweis ob E-Mail existiert)
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ success: true })
  }

  const { name } = profiles[0]

  // 2. User-ID holen
  const userRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      }
    }
  )
  const userData = await userRes.json()
  const userId = userData?.users?.[0]?.id
  if (!userId) return NextResponse.json({ success: true })

  // 3. Neues Zufallspasswort setzen → "entsperrt" den recovery-Token
  const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!'
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ password: tempPassword })
  })

  // 4. Recovery-Link generieren
  const resetRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      type: 'recovery',
      email,
      redirect_to: `${APP_URL}/passwort-setzen`
    })
  })

  const resetData = await resetRes.json()
  const resetLink = resetRes.ok && resetData.action_link
    ? resetData.action_link
    : `${APP_URL}/passwort-setzen`

  // 5. Mail senden
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: 'Ziel & Ergebnis <noreply@finanziellfrei.at>',
      to: email,
      subject: `Dein neuer Zugangslink, ${name}!`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff;">
          <h1 style="font-size: 22px; color: #1a1a1a; margin-bottom: 8px;">Dein neuer Zugang 📊</h1>
          <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Hallo ${name},<br><br>
            du hast einen neuen Zugangslink für <strong>Ziel & Ergebnis</strong> angefordert.
          </p>
          <a href="${resetLink}" style="display: inline-block; background: #2a6fa8; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
            Jetzt Passwort setzen &amp; anmelden →
          </a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #aaa; font-size: 12px;">
            Falls du diesen Link nicht angefordert hast, kannst du diese E-Mail ignorieren.<br>
            <strong>Ziel & Ergebnis</strong> – Mein Ziel = mein Ergebnis. Auf mich ist Verlass.
          </p>
        </div>
      `
    })
  })

  return NextResponse.json({ success: true })
}
