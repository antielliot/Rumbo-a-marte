// A* sobre la malla del DEM con costo multi-factor (ver el panel "datos considerados" de la app).
// Bloqueadas: más alto que el límite de altura, más empinadas que la pendiente máxima, sin dato, y esquinas diagonales.
// Costo de un paso = distancia × ( 1 + Σ peso × riesgo ), con cada riesgo normalizado a 0..1 (0 = ideal, 1 = lo peor).
// Así, peso 1 = en lo peor de ese factor, cada metro cuesta el doble que en terreno ideal.
import { effortRisk } from './effort.js'

// Heap binario con arreglos tipados (rápido para mallas de ~1 millón de celdas)
class MinHeap {
  constructor(cap = 1 << 16) { this.p = new Float64Array(cap); this.v = new Int32Array(cap); this.size = 0 }
  push(item, pr) {
    if (this.size === this.p.length) {
      const p = new Float64Array(this.size * 2), v = new Int32Array(this.size * 2)
      p.set(this.p); v.set(this.v); this.p = p; this.v = v
    }
    const { p, v } = this
    let i = this.size++
    while (i > 0) {
      const j = (i - 1) >> 1
      if (p[j] <= pr) break
      p[i] = p[j]; v[i] = v[j]; i = j
    }
    p[i] = pr; v[i] = item
  }
  pop() {
    const { p, v } = this
    const top = v[0]
    const lastP = p[--this.size], lastV = v[this.size]
    let i = 0
    for (;;) {
      let c = 2 * i + 1
      if (c >= this.size) break
      if (c + 1 < this.size && p[c + 1] < p[c]) c++
      if (p[c] >= lastP) break
      p[i] = p[c]; v[i] = v[c]; i = c
    }
    p[i] = lastP; v[i] = lastV
    return top
  }
}

// NaN (sin dato) también bloquea: "!(x <= max)" es verdadero para NaN
export function isBlocked(dem, i, { maxElev, maxSlope }) {
  return !(dem.elev[i] <= maxElev) || !(dem.slope[i] <= maxSlope)
}

// Parte del costo que depende solo de la celda destino (precalculada y cacheada).
// Infinity = bloqueada. Todos los términos son >= 0, así que el costo por metro es >= 1.
let cache = null
function prepare(dem, filter, w) {
  const c = cache
  if (c && c.elev === dem.elev && c.slope === dem.slope && c.rad === dem.radRisk && c.comm === dem.commRisk && c.rough === dem.roughRisk && c.sand === dem.sandRisk &&
      c.maxElev === filter.maxElev && c.maxSlope === filter.maxSlope && c.w.rad === w.rad && c.w.rough === w.rough && c.w.comm === w.comm && c.w.sand === (w.sand || 0)) return c
  const { n, elev, slope, radRisk, roughRisk, commRisk, sandRisk } = dem
  const cost = new Float32Array(n)
  let minStatic = Infinity
  for (let i = 0; i < n; i++) {
    if (!(elev[i] <= filter.maxElev) || !(slope[i] <= filter.maxSlope)) { cost[i] = Infinity; continue }
    const v = 1 + w.rad * (radRisk[i] || 0) + w.rough * (roughRisk[i] || 0) + w.comm * (commRisk[i] || 0) +
      (w.sand || 0) * ((sandRisk && sandRisk[i]) || 0)
    cost[i] = v
    if (v < minStatic) minStatic = v
  }
  // Heurística admisible: cada celda permitida cuesta como mínimo minStatic por metro (el esfuerzo solo suma).
  cache = { elev: dem.elev, slope: dem.slope, rad: dem.radRisk, comm: dem.commRisk, rough: dem.roughRisk, sand: dem.sandRisk,
    maxElev: filter.maxElev, maxSlope: filter.maxSlope, w: { ...w, sand: w.sand || 0 }, cost, mult: Number.isFinite(minStatic) ? minStatic : 1 }
  return cache
}

const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
const DY = [-1, -1, -1, 0, 0, 1, 1, 1]
const LEN = DX.map((x, k) => Math.hypot(x, DY[k]))
const OCT = Math.SQRT2 - 1

/** Devuelve { cells:[[x,y]...], distanceKm } o null si no hay ruta.
 *  w = { effort, rad, rough, comm, sand } (pesos de preferencia 0-5). */
export function findRoute(dem, start, end, filter, w = { effort: 1, rad: 0, rough: 0, comm: 0, sand: 0 }) {
  const { w: W, h: H, n, cellM, elev } = dem
  const { cost, mult } = prepare(dem, filter, w)
  const s = start[1] * W + start[0], e = end[1] * W + end[0]
  if (!Number.isFinite(cost[s]) || !Number.isFinite(cost[e])) return null

  const g = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const heap = new MinHeap()
  const ex = end[0], ey = end[1], k = mult * cellM
  const hh = (x, y) => {
    const dx = Math.abs(x - ex), dy = Math.abs(y - ey)
    return k * (dx > dy ? dx + OCT * dy : dy + OCT * dx)
  }
  const wE = w.effort
  g[s] = 0
  heap.push(s, hh(start[0], start[1]))

  while (heap.size) {
    const cur = heap.pop()
    if (closed[cur]) continue
    if (cur === e) break
    closed[cur] = 1
    const cx = cur % W, cy = (cur / W) | 0
    const gc = g[cur], zc = elev[cur]
    for (let d = 0; d < 8; d++) {
      const dx = DX[d], dy = DY[d]
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const nb = ny * W + nx
      const cn = cost[nb]
      if (cn === Infinity) continue
      // no cortar esquinas: en un paso diagonal, las dos celdas contiguas deben estar libres
      if (dx !== 0 && dy !== 0 && (cost[cy * W + nx] === Infinity || cost[ny * W + cx] === Infinity)) continue
      const dist = cellM * LEN[d]
      let step = cn
      if (wE > 0) {
        // esfuerzo según el gradiente del paso (subir cuesta más que bajar)
        step += wE * effortRisk((elev[nb] - zc) / dist)
      }
      const ng = gc + dist * step
      if (ng < g[nb]) {
        g[nb] = ng
        prev[nb] = cur
        heap.push(nb, ng + hh(nx, ny))
      }
    }
  }
  if (prev[e] === -1 && s !== e) return null

  const cells = []
  for (let c = e; c !== -1; c = prev[c]) cells.push([c % W, (c / W) | 0])
  cells.reverse()
  let dist = 0
  for (let i = 1; i < cells.length; i++)
    dist += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]) * cellM
  return { cells, distanceKm: dist / 1000 }
}

/** Desglose del costo de UN paso (celda i -> celda vecina j), con la misma fórmula que usa A*.
 *  Devuelve metros "equivalentes" por componente; la suma es el costo del paso. */
export function stepParts(dem, i, j, w) {
  const { w: W, cellM, elev } = dem
  const dxc = (j % W) - (i % W), dyc = ((j / W) | 0) - ((i / W) | 0)
  const len = Math.hypot(dxc, dyc)
  const dist = cellM * len
  const p = {
    dist,
    rad: dist * w.rad * (dem.radRisk[j] || 0),
    rough: dist * w.rough * (dem.roughRisk[j] || 0),
    comm: dist * w.comm * (dem.commRisk[j] || 0),
    sand: dist * (w.sand || 0) * ((dem.sandRisk && dem.sandRisk[j]) || 0),
    effort: 0,
  }
  if (w.effort > 0) {
    p.effort = dist * w.effort * effortRisk((elev[j] - elev[i]) / dist)
  }
  return p
}
