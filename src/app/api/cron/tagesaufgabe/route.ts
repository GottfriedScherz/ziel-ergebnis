import { NextRequest, NextResponse } from 'next/server'

async function sendEmails() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const RESEND_KEY = process.env.RESEND_API_KEY!

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  }

  const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,name,email`, { headers })
  const users = await usersRes.json()

  const wochentage = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']
  const heute = wochentage[new Date().getDay()]

  let sent = 0
  for (const user of users) {
    if (!user.email) continue
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'Ziel & Ergebnis <noreply@finanziellfrei.at>',
        to: user.email,
        subject: `☀️ ${user.name}, was bringt Dich heute Deinem Ziel näher?`,
        html: `
          <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
            
            <h2 style="font-size: 20px; margin: 0 0 8px;">Guten Morgen, ${user.name}! ☀️</h2>
            <p style="font-size: 13px; color: #888; margin: 0 0 24px;">Heute ist ${heute}.</p>

            <p style="font-size: 16px; font-weight: 600; margin: 0 0 4px;">🎯 Deine heutigen TOP 3 Aufgaben</p>
            <p style="font-size: 14px; color: #555; margin: 0 0 20px;">Aufschreiben · Ausführen · Abhaken.<br>3 Aufgaben erledigt = erfolgreicher Tag.</p>

            <div style="background: #f9f8f5; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px;">
              <ol style="font-size: 15px; line-height: 2.4; margin: 0; padding-left: 20px; color: #333;">
                <li>___________________________________</li>
                <li>___________________________________</li>
                <li>___________________________________</li>
              </ol>
            </div>

            <p style="font-size: 13px; color: #aaa; margin: 0;">
              Ziel & Ergebnis – Mein Ziel = mein Ergebnis. Auf mich ist Verlass.
            </p>

          </div>
        `
      })
    })
    sent++
  }
  return { success: true, sent }
}

export async function POST(req: NextRequest) {
  const result = await sendEmails()
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const result = await sendEmails()
  return NextResponse.json(result)
}
