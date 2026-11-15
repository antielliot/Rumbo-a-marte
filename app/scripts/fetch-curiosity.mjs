// Recorrido REAL de Curiosity (NASA/JPL, mapa MMGIS de la misión MSL) para usarlo como referencia (benchmark).
// No se usa para calcular nuestra ruta: solo se dibuja y se compara.
// Uso: npm run fetch-curiosity  -> public/data/curiosity-traverse.json
// Fuente: https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json (+ MSL_waypoints.json para sol y distancia)
import { writeFileSync } from 'node:fs'

const BASE = 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/'
const trav = await (await fetch(BASE + 'MSL_traverse.json')).json()
const wps = await (await fetch(BASE + 'MSL_waypoints.json')).json()

const pts = []
for (const f of trav.features) {
  const g = f.geometry
  const lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]
  for (const l of lines) for (const [lon, lat] of l) {
    const q = pts[pts.length - 1]
    if (!q || q[0] !== lon || q[1] !== lat) pts.push([lon, lat])
  }
}

// Simplificación Douglas-Peucker con tolerancia de ~2 m (en grados), iterativa
const TOL = 2 / ((2 * Math.PI * 3396190) / 360)
const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
const stack = [[0, pts.length - 1]]
while (stack.length) {
  const [a, b] = stack.pop()
  const [ax, ay] = pts[a], [bx, by] = pts[b]
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-12
  let dmax = 0, k = -1
  for (let i = a + 1; i < b; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L
    if (d > dmax) { dmax = d; k = i }
  }
  if (dmax > TOL) { keep[k] = 1; stack.push([a, k], [k, b]) }
}
const coords = pts.filter((_, i) => keep[i]).map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])
const last = wps.features[wps.features.length - 1].properties
// distancia acumulada oficial al final de cada sol con movimiento (para recortar el recorrido "hasta el sol X")
const bySol = new Map()
for (const f of wps.features) { const q = f.properties; bySol.set(q.sol, [+q.dist_km, +(+q.lon).toFixed(6), +(+q.lat).toFixed(6)]) }
const allSols = [...bySol].sort((a, b) => a[0] - b[0]).map(([sol, v]) => [sol, ...v]) // [sol, km, lon, lat]
// Quita errores puntuales de dist_km en los datos (p. ej. sol 1257 = 0 km, sol 3708 = 39.37 km):
// un valor que se aleja > 0.5 km de sus dos vecinos en la misma dirección
const sols = allSols.filter((r, i) => {
  const a = allSols[i - 1], b = allSols[i + 1]
  if (!a || !b) return true
  return !((r[1] - a[1] > 0.5 && r[1] - b[1] > 0.5) || (a[1] - r[1] > 0.5 && b[1] - r[1] > 0.5))
})
if (sols.length < allSols.length) console.log(`descartados ${allSols.length - sols.length} sols con dist_km erróneo`)
const out = {
  source: 'NASA/JPL MSL MMGIS: MSL_traverse.json / MSL_waypoints.json', url: BASE + 'MSL_traverse.json',
  sol: last.sol, distKm: last.dist_km, points: pts.length, sols, coords,
}
writeFileSync(new URL('../public/data/curiosity-traverse.json', import.meta.url), JSON.stringify(out))
console.log(`OK sol ${last.sol}, ${last.dist_km} km, ${pts.length} -> ${coords.length} puntos`)
