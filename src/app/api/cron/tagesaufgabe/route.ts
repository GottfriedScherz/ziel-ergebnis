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
        subject: `☀️ Guten Morgen ${user.name} – Was sind heute Deine 3 wichtigsten Aufgaben?`,
        html: `
          <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #1a1a1a;">Guten Morgen, ${user.name}! ☀️</h2>
            <p style="color: #444; font-size: 16px; line-height: 1.6; font-weight: 500;">
              Was sind heute Deine 3 wichtigsten Aufgaben um Deine langfristigen Ziele zu erreichen?
            </p>
            <div style="background: #f9f8f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="color: #888; font-size: 14px; margin: 0 0 12px;">Heute ist ${heute}. Fokussiere Dich auf das Wesentliche.</p>
              <ol style="color: #444; font-size: 15px; line-height: 2; margin: 0; padding-left: 20px;">
                <li>___________________________________</li>
                <li>___________________________________</li>
                <li>___________________________________</li>
              </ol>
            </div>
            <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
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
