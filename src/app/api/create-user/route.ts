import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, email, karrierestufe, betreuer_id } = await req.json()

  if (!name || !email) {
    return NextResponse.json({ error: 'Name und E-Mail sind erforderlich.' }, { status: 400 })
  }

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const RESEND_KEY = process.env.RESEND_API_KEY!
  const APP_URL = 'https://ziel-ergebnis.vercel.app'

  // 1. Generate invite link via Supabase
  const inviteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ email, data: { name } })
  })

  const inviteText = await inviteRes.text()
  console.log('Invite status:', inviteRes.status, inviteText)

  let userId: string | null = null

  if (inviteRes.ok) {
    const inviteData = JSON.parse(inviteText)
    userId = inviteData.id

    // Send custom welcome email via Resend
    if (RESEND_KEY) {
      const emailHtml = `
        <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff;">
          <h1 style="font-size: 22px; color: #1a1a1a; margin-bottom: 8px;">Willkommen bei Ziel & Ergebnis! 📊</h1>
          <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
            Hallo ${name},<br><br>
            du wurdest als Partner im <strong>Ziel & Ergebnis Performance Tracking</strong> System eingeladen.
          </p>
          <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Klicke auf den Button unten um dein persönliches Passwort zu setzen und dich anzumelden:
          </p>
          <a href="${APP_URL}" style="display: inline-block; background: #2a6fa8; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
            Jetzt Passwort setzen & anmelden →
          </a>
          <p style="color: #888; font-size: 13px; line-height: 1.5; margin-bottom: 8px;">
            <strong>So geht's:</strong><br>
            1. Klicke auf den Button oben (du erhältst eine separate E-Mail von Supabase mit dem direkten Link)<br>
            2. Setze dein persönliches Passwort<br>
            3. Melde dich unter <a href="${APP_URL}" style="color: #2a6fa8;">${APP_URL}</a> an
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #aaa; font-size: 12px;">
            Bei Fragen wende dich an deinen Betreuer.<br>
            Ziel & Ergebnis – Mein Ziel = mein Ergebnis. Auf mich ist Verlass.
          </p>
        </div>
      `

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: 'Ziel & Ergebnis <noreply@finanziellfrei.at>',
          to: email,
          subject: 'Willkommen bei Ziel & Ergebnis – Bitte Passwort setzen',
          html: emailHtml,
        })
      })
    }
  } else {
    // Fallback: create with password
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ email, password: Math.random().toString(36).slice(-10) + 'Aa1!' })
    })
    const signupData = await signupRes.json()
    if (!signupRes.ok) {
      const msg = (signupData.msg || signupData.message || '').toLowerCase()
      if (msg.includes('already') || signupRes.status === 422) {
        return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 400 })
      }
      return NextResponse.json({ error: signupData.msg || 'Fehler beim Anlegen.' }, { status: 400 })
    }
    userId = signupData.id || signupData.user?.id
  }

  if (!userId) {
    return NextResponse.json({ error: 'Nutzer angelegt aber ID nicht gefunden.' }, { status: 400 })
  }

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
      id: userId, name, email,
      karrierestufe: parseInt(karrierestufe),
      is_admin: false,
      betreuer_id: betreuer_id || null,
    })
  })

  if (!profileRes.ok) {
    const err = await profileRes.json()
    console.error('Profile error:', err)
    return NextResponse.json({ error: 'Profil konnte nicht erstellt werden: ' + (err.message || '') }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId })
}
