import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

function headers() {
  return {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=representation',
  }
}

async function supabase(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (method === 'DELETE' || res.status === 204) return null
  return res.json()
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'save') {
    const { user_id, monat, woche, jahr, eintraege, existingId } = body
    let berichtId = existingId

    if (berichtId) {
      await supabase(`vm_berichte?id=eq.${berichtId}`, 'PATCH', { updated_at: new Date().toISOString() })
    } else {
      const existing = await supabase(`vm_berichte?user_id=eq.${user_id}&monat=eq.${monat}&woche=eq.${woche}&jahr=eq.${jahr}`)
      if (existing?.[0]) {
        berichtId = existing[0].id
        await supabase(`vm_berichte?id=eq.${berichtId}`, 'PATCH', { updated_at: new Date().toISOString() })
      } else {
        const res = await supabase('vm_berichte', 'POST', { user_id, monat, woche, jahr })
        berichtId = res?.[0]?.id
      }
    }

    if (!berichtId) return NextResponse.json({ error: 'Bericht konnte nicht angelegt werden.' }, { status: 500 })

    await supabase(`vm_eintraege?vm_bericht_id=eq.${berichtId}`, 'DELETE')
    if (eintraege?.length > 0) {
      await supabase('vm_eintraege', 'POST', eintraege.map((e: any) => ({ ...e, vm_bericht_id: berichtId })))
    }

    return NextResponse.json({ success: true, id: berichtId })
  }

  if (action === 'get') {
    const { id } = body
    const bericht = await supabase(`vm_berichte?id=eq.${id}&select=*,profiles(name,avatar_url)`)
    if (!bericht?.[0]) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
    const eintraege = await supabase(`vm_eintraege?vm_bericht_id=eq.${id}`)
    return NextResponse.json({ bericht: bericht[0], eintraege: eintraege || [] })
  }

  if (action === 'delete') {
    const { id } = body
    await supabase(`vm_berichte?id=eq.${id}`, 'DELETE')
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
