import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { action, id, name, stufe_min, aktiv, reihenfolge } = await req.json()
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=representation',
  }

  if (action === 'insert') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/formular_zeilen`, {
      method: 'POST', headers,
      body: JSON.stringify({ name, stufe_min, reihenfolge, aktiv: true })
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: 400 })
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data })
  }

  if (action === 'update') {
    const body: any = {}
    if (name !== undefined) body.name = name
    if (stufe_min !== undefined) body.stufe_min = stufe_min
    if (aktiv !== undefined) body.aktiv = aktiv
    const res = await fetch(`${SUPABASE_URL}/rest/v1/formular_zeilen?id=eq.${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify(body)
    })
    if (!res.ok) return NextResponse.json({ error: 'update failed' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (action === 'update_eintraege_zeile') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/eintraege?zeile=eq.${encodeURIComponent(name)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ zeile: aktiv })
    })
    if (!res.ok) return NextResponse.json({ error: 'eintraege update failed' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
