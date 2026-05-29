import { NextRequest, NextResponse } from 'next/server'

const MONATE = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function getAktuelleWoche(): { monat: string, woche: string, jahr: number } {
  const now = new Date()
  const jahr = now.getFullYear()
  const monat = MONATE[now.getMonth()]
  const monthIdx = now.getMonth()
  const firstOfMonth = new Date(jahr, monthIdx, 1)
  const dow = firstOfMonth.getDay() === 0 ? 6 : firstOfMonth.getDay() - 1
  let monday: Date
  if (dow <= 2) {
    monday = new Date(jahr, monthIdx, 1 - dow)
  } else {
    monday = new Date(jahr, monthIdx, 1 + (7 - dow))
  }
  let weekNum = 1
  let current = new Date(monday)
  while (current <= now) {
    const next = new Date(current.getTime() + 7 * 86400000)
    if (next > now) break
    weekNum++
    current = next
  }
  return { monat, woche: `Woche ${weekNum}`, jahr }
}

async function sendReminders() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const RESEND_KEY = process.env.RESEND_API_KEY!
  const APP_URL = 'https://ziel-ergebnis.vercel.app'

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  }

  const { monat, woche, jahr } = getAktuelleWoche()

  const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,name,email`, { headers })
  const users = await usersRes.json()

  const berichteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/berichte?monat=eq.${encodeURIComponent(monat)}&woche=eq.${encodeURIComponent(woche)}&jahr=eq.${jahr}&select=user_id`,
    { headers }
  )
  const berichte = await berichteRes.json()
  const erledigt = new Set(berichte.map((b: any) => b.user_id))

  const pending = users.filter((u: any) => !erledigt.has(u.id) && u.email)

  let sent = 0
  for (const user of pending) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'Ziel & Ergebnis <noreply@finanziellfrei.at>',
        to: user.email,
        subject: '📋 Wochenbericht noch offen',
        html: `
          <div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #1a1a1a;">Hallo ${user.name}!</h2>
            <p style="color: #444; font-size: 15px; line-height: 1.6;">
              Dein Wochenbericht für <strong>${monat} / ${woche}</strong> wurde noch nicht eingegeben.
            </p>
            <p style="color: #444; font-size: 15px; line-height: 1.6;">
              Nimm dir kurz Zeit und trag deine Aktivitäten ein — es dauert nur wenige Minuten.
            </p>
            <a href="${APP_URL}/bericht" style="display: inline-block; background: #2a6fa8; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin-top: 8px;">
              Jetzt Wochenbericht eingeben →
            </a>
            <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
              Ziel & Ergebnis – Mein Ziel = mein Ergebnis. Auf mich ist Verlass.
            </p>
          </div>
        `
      })
    })
    sent++
  }

  return { success: true, sent, pending: pending.length }
}

export async function POST(req: NextRequest) {
  const result = await sendReminders()
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const result = await sendReminders()
  return NextResponse.json(result)
}
