import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { email, name } = await req.json()
  if (!email || !name) return NextResponse.json({ error: 'Email und Name erforderlich.' }, { status: 400 })

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const RESEND_KEY = process.env.RESEND_API_KEY!
  const APP_URL = 'https://ziel-ergebnis.vercel.app'

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
  let resetLink = `${APP_URL}/passwort-setzen`
  if (resetRes.ok && resetData.action_link) resetLink = resetData.action_link

  if (RESEND_KEY) {
    const emailHtml = `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #fff;">
        <h1 style="font-size: 22px; color: #1a1a1a; margin-bottom: 8px;">Dein Zugang zu Ziel & Ergebnis 📊</h1>
        <p style="color: #444; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          Hallo ${name},<br><br>
          hier ist dein neuer Einladungslink für <strong>Ziel & Ergebnis</strong>.
        </p>
        <a href="${resetLink}" style="display: inline-block; background: #2a6fa8; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
          Jetzt Passwort setzen &amp; anmelden →
        </a>
        <p style="color: #888; font-size: 13px; line-height: 1.5; margin-top: 24px;">
          Der Link ist 24 Stunden gültig.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #aaa; font-size: 12px;">
          Bei Fragen wende dich an deinen Betreuer.<br>
          <strong>Ziel & Ergebnis</strong> – Mein Ziel = mein Ergebnis. Auf mich ist Verlass.
        </p>
      </div>
    `
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: 'Ziel & Ergebnis <noreply@finanziellfrei.at>',
        to: email,
        subject: `Dein Zugang zu Ziel & Ergebnis, ${name}!`,
        html: emailHtml,
      })
    })
  }

  return NextResponse.json({ success: true })
}
