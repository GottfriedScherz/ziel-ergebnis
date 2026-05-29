import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=representation',
  }

  if (action === 'update_user') {
    const { id, field, value } = body
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ [field]: value })
    })
    if (!res.ok) return NextResponse.json({ error: 'update_user failed' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (action === 'insert') {
    const { name, stufe_min, reihenfolge } = body
    const res = await fetch(`${SUPABASE_URL}/rest/v1/formular_zeilen`, {
      method: 'POST', headers,
      body: JSON.stringify({ name, stufe_min, reihenfolge, aktiv: true })
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: 400 })
    return NextResponse.json({ data: Array.isArray(data) ? data[0] : data })
  }

  if (action === 'update') {
    const { id, ...rest } = body
    const updateBody: any = {}
    if (rest.name !== undefined) updateBody.name = rest.name
    if (rest.stufe_min !== undefined) updateBody.stufe_min = rest.stufe_min
    if (rest.aktiv !== undefined) updateBody.aktiv = rest.aktiv
    const res = await fetch(`${SUPABASE_URL}/rest/v1/formular_zeilen?id=eq.${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify(updateBody)
    })
    if (!res.ok) return NextResponse.json({ error: 'update failed' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  if (action === 'update_eintraege_zeile') {
    const { name, aktiv: newName } = body
    const res = await fetch(`${SUPABASE_URL}/rest/v1/eintraege?zeile=eq.${encodeURIComponent(name)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ zeile: newName })
    })
    if (!res.ok) return NextResponse.json({ error: 'eintraege update failed' }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
