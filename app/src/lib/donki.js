// Alertas de clima espacial desde NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information).
// Origen: server/services/donki.ts de Rumbo Marte. Aquí se llama directo desde el navegador a api.nasa.gov,
// que permite CORS. Usa VITE_NASA_API_KEY del .env (ver .env.example); sin clave usa DEMO_KEY, con límite bajo.
//
// DONKI no marca directamente "impacto en Marte" en los eventos SEP. Se considera activo un evento si hubo
// SEP reciente o una notificación que menciona Marte. Es una heurística: el interruptor manual de la app se queda.

const BASE = 'https://api.nasa.gov/DONKI'
const KEY = import.meta.env?.VITE_NASA_API_KEY || 'DEMO_KEY'

const isoDate = (d) => d.toISOString().slice(0, 10)

async function getJson(path, params) {
  const q = new URLSearchParams({ ...params, api_key: KEY })
  const r = await fetch(`${BASE}/${path}?${q}`, { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`DONKI respondió ${r.status}`)
  const text = await r.text()
  return text.trim() ? JSON.parse(text) : [] // DONKI devuelve cuerpo vacío cuando no hay eventos
}

/** { active, checkedAt, recentSep, marsNotifications, error? } */
export async function checkSolarAlert(lookbackDays = 3, now = new Date()) {
  const startDate = isoDate(new Date(now.getTime() - lookbackDays * 86400000))
  const endDate = isoDate(now)
  const checkedAt = now.toISOString()
  try {
    const [sep, notes] = await Promise.all([
      getJson('SEP', { startDate, endDate }),
      getJson('notifications', { startDate, endDate, type: 'all' }),
    ])
    const marsNotifications = (notes || []).filter((n) => /\bmars\b/i.test(n.messageBody || ''))
    const recentSep = sep || []
    return { active: recentSep.length > 0 || marsNotifications.length > 0, checkedAt, recentSep, marsNotifications }
  } catch (e) {
    return { active: false, checkedAt, recentSep: [], marsNotifications: [], error: e.message || String(e) }
  }
}
