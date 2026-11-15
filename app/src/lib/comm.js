// Línea de vista desde la base (análisis de visibilidad por rayos sobre el DEM).
// Aproximado: el DEM está de 200 m, así que lomas pequeñas no se resuelven.
import { CONST } from './constants.js'

const R_MARS = 3396190 // m; la superficie cae d²/2R por debajo de la tangente (a 20 km ≈ 59 m)

/** Devuelve { visible: Uint8Array (1 = hay línea de vista), baseCell } */
export function viewshed(dem) {
  const { w, h, n, elev, cellM } = dem
  let b = dem.cellOf(CONST.BASE.lon, CONST.BASE.lat)
  if (!b) return { visible: new Uint8Array(n), baseCell: null }
  // si la celda de la base no tiene dato, usar la más cercana con dato
  if (Number.isNaN(elev[b[1] * w + b[0]])) {
    let best = null, bd = Infinity
    for (let y = Math.max(0, b[1] - 20); y < Math.min(h, b[1] + 20); y++)
      for (let x = Math.max(0, b[0] - 20); x < Math.min(w, b[0] + 20); x++)
        if (!Number.isNaN(elev[y * w + x])) { const d = Math.hypot(x - b[0], y - b[1]); if (d < bd) { bd = d; best = [x, y] } }
    if (!best) return { visible: new Uint8Array(n), baseCell: null }
    b = best
  }
  const [bx, by] = b
  const zObs = elev[by * w + bx] + CONST.ANTENNA_H_M
  const visible = new Uint8Array(n)
  visible[by * w + bx] = 1
  const rmax = Math.max(Math.hypot(bx, by), Math.hypot(w - bx, by), Math.hypot(bx, h - by), Math.hypot(w - bx, h - by))
  const RAYS = Math.ceil(4 * Math.PI * rmax) // 2 rayos por celda de perímetro: sin huecos lejos de la base
  for (let k = 0; k < RAYS; k++) {
    const a = (2 * Math.PI * k) / RAYS, dx = Math.cos(a), dy = Math.sin(a)
    let maxAngle = -Infinity
    for (let r = 1; ; r++) {
      const x = Math.round(bx + dx * r), y = Math.round(by + dy * r)
      if (x < 0 || y < 0 || x >= w || y >= h) break
      const i = y * w + x
      if (Number.isNaN(elev[i])) continue
      const d = Math.hypot(x - bx, y - by) * cellM
      const z = elev[i] - (d * d) / (2 * R_MARS) // altura efectiva con curvatura
      if ((z + CONST.ANTENNA_H_M - zObs) / d >= maxAngle) visible[i] = 1
      const ground = (z - zObs) / d
      if (ground > maxAngle) maxAngle = ground
    }
  }
  return { visible, baseCell: b }
}
