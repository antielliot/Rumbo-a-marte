// Explica POR QUÉ la ruta gira: en cada giro compara el tramo real con el atajo recto que A* no tomó,
// usando exactamente la misma fórmula de costo (stepParts). El motivo es el factor que más encarece el atajo.
import { stepParts, isBlocked } from './route.js'
import { CONST } from './constants.js'

// Etiquetas y colores por motivo (los usan el mapa y la barra lateral)
export const REASONS = {
  slope: { icon: '⛰', label: 'Pendiente', color: '#ef4444' },
  height: { icon: '▲', label: 'Altura máxima', color: '#f97316' },
  nodata: { icon: '?', label: 'Sin datos', color: '#94a3b8' },
  effort: { icon: '↗', label: 'Subida', color: '#f59e0b' },
  sand: { icon: '≈', label: 'Dunas', color: '#d97706' },
  rad: { icon: '☢', label: 'Radiación', color: '#a855f7' },
  comm: { icon: '📡', label: 'Comunicación', color: '#3b82f6' },
  rough: { icon: '▦', label: 'Terreno rugoso', color: '#14b8a6' },
}

// Celdas de una línea recta entre dos celdas (Bresenham, 8-conectada)
function lineCells([x0, y0], [x1, y1]) {
  const out = []
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy, x = x0, y = y0
  for (;;) {
    out.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
  return out
}

// Distancia de un punto a un segmento (en celdas)
function distSeg([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy
  const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// Douglas-Peucker sobre los índices de la ruta: devuelve los índices de los giros importantes
function turns(cells, tol) {
  const keep = new Uint8Array(cells.length)
  keep[0] = keep[cells.length - 1] = 1
  const st = [[0, cells.length - 1]]
  while (st.length) {
    const [a, b] = st.pop()
    let dmax = 0, k = -1
    for (let i = a + 1; i < b; i++) {
      const d = distSeg(cells[i], cells[a], cells[b])
      if (d > dmax) { dmax = d; k = i }
    }
    if (dmax > tol) { keep[k] = 1; st.push([a, k], [k, b]) }
  }
  const idx = []
  keep.forEach((v, i) => v && idx.push(i))
  return idx
}

const ZERO = () => ({ dist: 0, rad: 0, rough: 0, comm: 0, sand: 0, effort: 0 })

// Recorre una lista de celdas y suma costos por componente + datos físicos para las frases
function evaluate(dem, cells, w, filter) {
  const W = dem.w
  const sum = ZERO()
  let climb = 0, sandM = 0, noCommM = 0, maxSlope = 0, block = null
  for (let k = 1; k < cells.length; k++) {
    const i = cells[k - 1][1] * W + cells[k - 1][0], j = cells[k][1] * W + cells[k][0]
    const diag = cells[k][0] !== cells[k - 1][0] && cells[k][1] !== cells[k - 1][1]
    const pinched = diag && isBlocked(dem, cells[k - 1][1] * W + cells[k][0], filter) && isBlocked(dem, cells[k][1] * W + cells[k - 1][0], filter)
    if (!block && (isBlocked(dem, j, filter) || pinched)) {
      const z = dem.elev[j]
      block = { at: cells[k], kind: Number.isNaN(z) ? 'nodata' : z > filter.maxElev ? 'height' : 'slope', slope: dem.slope[j], elev: z }
    }
    const p = stepParts(dem, i, j, w)
    for (const key in sum) sum[key] += Number.isFinite(p[key]) ? p[key] : 0
    const dz = dem.elev[j] - dem.elev[i]
    if (dz > 0) climb += dz
    sandM += p.dist * ((dem.sandRisk && dem.sandRisk[j]) || 0)
    if (dem.commRisk[j] === 1) noCommM += p.dist
    if (dem.slope[j] > maxSlope) maxSlope = dem.slope[j]
  }
  const total = Object.values(sum).reduce((a, b) => a + b, 0)
  return { sum, total, climb, sandM, noCommM, maxSlope, block }
}

const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`)

/** Explica los giros de una ruta. Devuelve { items: [...], summary: {motivo: n} } */
export function explainRoute(dem, route, w, filter) {
  const cells = route.cells
  if (cells.length < 3) return { items: [], summary: {} }
  // tolerancia: ignora zigzags de la cuadrícula; giros de al menos ~3 celdas o 2 % del largo directo
  const direct = Math.hypot(cells[cells.length - 1][0] - cells[0][0], cells[cells.length - 1][1] - cells[0][1])
  const tol = Math.max(3, 0.02 * direct)
  const idx = turns(cells, tol)
  const items = []
  for (let t = 1; t < idx.length - 1; t++) {
    const a = idx[t - 1], k = idx[t], b = idx[t + 1]
    const actual = cells.slice(a, b + 1)
    const shortcut = lineCells(cells[a], cells[b])
    const A = evaluate(dem, actual, w, filter)
    const S = evaluate(dem, shortcut, w, filter)
    // lado del giro: + = el vértice queda a la izquierda del atajo (malla: x = este, y = sur)
    const [ax, ay] = cells[a], [bx, by] = cells[b], [vx, vy] = cells[k]
    const cross = (bx - ax) * -(vy - ay) - -(by - ay) * (vx - ax)
    const side = cross > 0 ? 'izquierda' : 'derecha'
    // metros que añade el desvío frente a la línea recta real (no la escalera de celdas)
    const extra = A.sum.dist - Math.hypot(cells[b][0] - cells[a][0], cells[b][1] - cells[a][1]) * dem.cellM
    let reason, text
    if (S.block) {
      reason = S.block.kind
      text = reason === 'slope'
        ? `Gira a la ${side}: ir derecho cruza una pendiente de ${S.block.slope.toFixed(0)}° (máximo ${CONST.MAX_SLOPE_DEG}°).`
        : reason === 'height'
          ? `Gira a la ${side}: ir derecho supera la altura máxima (${Math.round(S.block.elev)} m).`
          : `Gira a la ${side}: ir derecho pasa por una zona sin datos de relieve.`
    } else {
      // diferencia por componente (atajo − real): la mayor positiva es la causa
      const keys = ['effort', 'sand', 'rad', 'comm', 'rough']
      const diffs = keys.map((key) => [key, S.sum[key] - A.sum[key]]).sort((p, q) => q[1] - p[1])
      if (!(S.total > A.total) || diffs[0][1] <= 0) continue // giro sin motivo claro (efecto de la cuadrícula)
      reason = diffs[0][0]
      const gain = (100 * (S.total - A.total)) / S.total
      const why = {
        effort: `ir derecho sube ${Math.round(S.climb - A.climb)} m más; el desvío es más llano`,
        sand: `ir derecho cruza ${fmtM(S.sandM - A.sandM)} más de campo de dunas (USGS)`,
        rad: 'ir derecho pasa por terreno más alto, con más radiación',
        comm: `ir derecho pierde la línea de vista con la base durante ${fmtM(S.noCommM - A.noCommM)} más`,
        rough: 'ir derecho cruza terreno más rugoso',
      }[reason]
      const add = extra < 25 ? 'casi sin alargar el camino' : `añade ${fmtM(extra)} de camino`
      text = `Gira a la ${side}: ${why}. El desvío ${add} y cuesta ${gain.toFixed(0)}% menos.`
    }
    items.push({ n: items.length + 1, at: cells[k], side, reason, text, shortcut: [cells[a], cells[b]], hot: S.block?.at ?? null, extraM: extra })
  }
  const summary = {}
  for (const it of items) summary[it.reason] = (summary[it.reason] || 0) + 1
  return { items, summary }
}
