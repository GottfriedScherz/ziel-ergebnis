const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sb_access_token') : null
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': token ? `Bearer ${token}` : `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation',
  }
}

export async function dbQuery(table: string, params: string = '') {
  const headers = getAuthHeaders()
  console.log('dbQuery headers Authorization starts with:', headers['Authorization'].substring(0,30))
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params ? '?' + params : ''}`, { headers })
  if (!res.ok) {
    console.error(`dbQuery ${table} failed:`, res.status, await res.text())
    return null
  }
  return res.json()
}

export async function dbInsert(table: string, body: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) { console.error(`dbInsert ${table} failed:`, res.status); return null }
  return res.json()
}

export async function dbUpdate(table: string, params: string, body: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) { console.error(`dbUpdate ${table} failed:`, res.status); return null }
  return res.json()
}

export async function dbDelete(table: string, params: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
}

export function getUser() {
  if (typeof window === 'undefined') return null
  const u = localStorage.getItem('sb_user')
  return u ? JSON.parse(u) : null
}

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sb_access_token')
}

export function logout() {
  localStorage.removeItem('sb_access_token')
  localStorage.removeItem('sb_refresh_token')
  localStorage.removeItem('sb_user')
}
