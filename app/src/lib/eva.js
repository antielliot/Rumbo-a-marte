// Simulador de caminata (EVA) sobre la ruta A* real.
// Contrato mínimo con la malla: w, h, cellM, elev, slope, lonLat(x, y). Lo demás es opcional, para que siga
// funcionando con el motor GeoTIFF del plan de migración: sin rad usa la tasa medida por RAD, sin visible
// no avisa de comunicación, sin sandRisk no avisa de dunas y sin baseCell el único refugio es la salida. Origen: sim.ts + science.ts de Rumbo Marte,
// reescrito para correr en el navegador sobre el DEM de Gale (sin servidor).
//
// Qué es dato y qué es supuesto (también se ve en el panel "Datos considerados"):
//   - Posición, elevación, pendiente, línea de vista y dunas: del DEM y del USGS, celda por celda.
//   - Radiación: dem.rad (modelo anclado en MSL/RAD, lib/radiation.js). La tormenta solar la multiplica
//     por EVA.SPE_FACTOR y un refugio la reduce a EVA.SHELTER_FACTOR (supuestos de Rumbo Marte).
//   - Temperatura y presión: Mars Climate Database (gale-temp.json), por estación y hora, interpolada.
//   - Sol: lib/sun.js (geometría real).
//   - Oxígeno, batería y consumo: valores de ejemplo del traje (lib/suit.js, AxEMU). SUPUESTOS.
import { CONST } from './constants.js'
import { effortRel } from './effort.js'
import { sunPosition } from './sun.js'
import { margenRegreso, LIMITES } from './seguridad.js'
import { SUIT_AXEMU, RADIATION } from './marsData.js'
import { DEFAULT_SETTINGS } from './routeEvaluator.js'

export const EVA = {
  SPE_FACTOR: 8, // supuesto: multiplicador de dosis durante un evento de partículas solares
  SHELTER_FACTOR: 0.15, // supuesto: dosis dentro del hábitat o del rover presurizado
  SHELTER_RADIUS_M: 300, // a menos de esto del punto de salida o de la base se está "a cubierto"
  STORM_TAU: 4.5, // tormenta de polvo fuerte: rojo en EVA (≥3), traje (≥4) y evaluador (≥4)
  RED_DOSE_MSV_DAY: 3, // regla de Rumbo Marte: 3 mSv/día o más = suspender la caminata
  O2_H: SUIT_AXEMU.maxEvaHours.value, // 8 h de soporte vital (AxEMU)
  BATTERY_WH: 900, // supuesto: batería del traje (lib/suit.js, TRAJE_LUNAR/MARCIANO)
  SUIT_POWER_W: 100, // supuesto: consumo eléctrico medio del traje (radio, ventilación, HUD)
  PERCHLORATE_PCT: 0.5, // supuesto: perclorato del regolito (Phoenix y Curiosity midieron ~0.3–0.6 %)
  STORM_WARNING_MIN: 30, // supuesto: aviso disponible ante una tormenta solar
}

const M_PER_DEG = (2 * Math.PI * 3396190) / 360
const radAt = (dem, i) => dem.rad?.[i] ?? RADIATION.surfaceEquivalentMSvPerDay.value
const H_SCALE = (188.9 * 210) / 3.71 // misma atmósfera isoterma que lib/radiation.js

/** Rumbo en grados (0 = norte, 90 = este) de [lon,lat] a [lon,lat]. */
export function bearing([lon1, lat1], [lon2, lat2]) {
  const kx = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  const dx = (lon2 - lon1) * kx, dy = lat2 - lat1
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}
/** Distancia en metros entre dos [lon,lat] (aproximación local, suficiente dentro de Gale). */
export function distM([lon1, lat1], [lon2, lat2]) {
  const kx = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  return Math.hypot((lon2 - lon1) * kx, lat2 - lat1) * M_PER_DEG
}
const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
export const cardinal = (deg) => CARD[Math.round(deg / 45) % 8]

/** Geometría de la ruta: distancia acumulada por celda y posición de cada giro explicado. */
export function routeGeometry(dem, route, why) {
  const cells = route.cells
  const cum = new Float64Array(cells.length)
  for (let k = 1; k < cells.length; k++)
    cum[k] = cum[k - 1] + Math.hypot(cells[k][0] - cells[k - 1][0], cells[k][1] - cells[k - 1][1]) * dem.cellM
  const key = (c) => c[1] * dem.w + c[0]
  const where = new Map(cells.map((c, k) => [key(c), k]))
  const turns = (why?.items ?? [])
    .map((it) => ({ n: it.n, text: it.text, reason: it.reason, s: cum[where.get(key(it.at)) ?? 0] }))
    .sort((a, b) => a.s - b.s)
  return { cells, cum, length: cum[cells.length - 1], turns }
}

/** Posición a s metros del inicio: celda, [lon,lat] interpolado y rumbo del tramo. */
export function positionAt(dem, geo, s) {
  const { cells, cum, length } = geo
  s = Math.max(0, Math.min(length, s))
  let lo = 0, hi = cells.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m }
  const a = dem.lonLat(...cells[lo]), b = dem.lonLat(...cells[hi])
  const f = cum[hi] > cum[lo] ? (s - cum[lo]) / (cum[hi] - cum[lo]) : 0
  const lonlat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  const cell = f < 0.5 ? cells[lo] : cells[hi]
  return { cell, i: cell[1] * dem.w + cell[0], lonlat, heading: bearing(a, b), seg: lo }
}

/** Temperatura (°C) y presión (Pa) de la MCD a una hora decimal, interpolando la tabla de 2 h. */
export function climateAt(temp, ls, hour) {
  const row = temp?.table?.[ls]
  if (!row) return null
  const h0 = Math.floor(hour / 2) * 2 % 24, h1 = (h0 + 2) % 24, f = (hour - Math.floor(hour / 2) * 2) / 2
  const a = row[h0], b = row[h1]
  const lerp = (k) => a[k] + (b[k] - a[k]) * f
  return { surfC: lerp('surf') - 273.15, airC: lerp('air') - 273.15, presPa: lerp('pres') }
}

/** Velocidad de marcha (km/h) con la penalización por polvo del evaluador de rutas. */
export const walkSpeedKmh = (tau) => CONST.WALK_KMH / (1 + DEFAULT_SETTINGS.speedPenaltyPerTau * tau)

/** Estado inicial del simulador. */
export function initialState(hour = 12) {
  return { mode: 'idle', dir: 1, s: 0, hours: 0, clock: hour, sol: 1, doseMSv: 0, o2UsedH: 0, battUsedWh: 0, log: [], solAcc: newSol() }
}
const newSol = () => ({ doseMSv: 0, hours: 0, evaH: 0, flare: false, dust: false })

/**
 * Lee todo lo que ve el astronauta en su posición actual. No modifica el estado.
 * env = { flare, dustTau, ls, temp }
 */
export function readTelemetry(dem, geo, st, env) {
  const p = positionAt(dem, geo, st.s)
  const { i, lonlat } = p
  const start = dem.lonLat(...geo.cells[0])
  const endLL = dem.lonLat(...geo.cells[geo.cells.length - 1])
  const base = dem.baseCell ? dem.lonLat(...dem.baseCell) : null
  const tau = env.dustTau ?? 0.5
  const speed = walkSpeedKmh(tau)

  // refugios: el punto de salida (hábitat o rover presurizado) y la base
  const dStart = st.s // camino conocido: volver por la misma ruta
  const dBase = base ? distM(lonlat, base) : Infinity
  const inShelter = dStart < EVA.SHELTER_RADIUS_M || dBase < EVA.SHELTER_RADIUS_M
  // El refugio al que se va es el punto de salida, por el camino ya recorrido (ruta conocida y segura).
  // Si la salida es la base, el refugio es el hábitat; si no, se asume un rover presurizado ahí.
  const startIsBase = base && distM(start, base) < EVA.SHELTER_RADIUS_M
  const shelter = { name: startIsBase ? 'Base Bradbury (hábitat)' : 'Punto de salida (rover presurizado)', distKm: dStart / 1000, bearing: bearing(lonlat, start), lonlat: start }

  const rad0 = radAt(dem, i) // mSv/día del modelo, sin tormenta ni refugio
  const doseRate = rad0 * (env.flare ? EVA.SPE_FACTOR : 1) * (inShelter ? EVA.SHELTER_FACTOR : 1)
  const clim = climateAt(env.temp, env.ls, st.clock)
  // presión en la celda: la de la MCD (centro de Gale) corregida por altura, como en lib/radiation.js
  const presPa = clim && env.tempElev !== undefined ? clim.presPa * Math.exp(-(dem.elev[i] - env.tempElev) / H_SCALE) : clim?.presPa ?? null
  const sun = sunPosition(lonlat[1], env.ls, st.clock)
  const sunElev = (sun.elev * 180) / Math.PI
  const slope = dem.slope[i]
  const comm = dem.visible ? !!dem.visible[i] : true
  const sand = dem.sandRisk?.[i] ?? 0
  const excursionKm = base ? distM(lonlat, base) / 1000 : 0

  // consumibles y margen de regreso (walkback de Apolo): volver por el camino ya recorrido
  const o2LeftH = Math.max(0, EVA.O2_H - st.o2UsedH)
  const battLeftWh = Math.max(0, EVA.BATTERY_WH - st.battUsedWh)
  const backH = dStart / 1000 / speed
  const m = margenRegreso(o2LeftH, backH)
  const margin = { ratio: Number.isFinite(m.ratio) ? m.ratio : 99, level: { verde: 'verde', amarillo: 'ambar', rojo: 'rojo' }[m.nivel], backH, atStart: dStart < 1 }

  // destino actual (ida: el final de la ruta; regreso: el punto de salida)
  const goal = st.dir > 0 ? endLL : start
  const remainingM = st.dir > 0 ? geo.length - st.s : st.s
  const nextTurn = st.dir > 0 ? geo.turns.find((t) => t.s > st.s + 1) ?? null : null

  const reasons = []
  const red = (text) => reasons.push({ level: 'rojo', text })
  const amber = (text) => reasons.push({ level: 'ambar', text })
  if (doseRate >= EVA.RED_DOSE_MSV_DAY) red(`Radiación de ${doseRate.toFixed(1)} mSv/día${env.flare ? ' por tormenta solar' : ''}. Ve al refugio.`)
  if (tau >= 3) red(`Tormenta de polvo (τ ${tau.toFixed(1)}): poca visibilidad y menos energía.`)
  if (margin.level === 'rojo') red(`Punto de no retorno: el O₂ apenas alcanza para volver (${margin.ratio.toFixed(2)}×). Regresa ya.`)
  if (battLeftWh / EVA.BATTERY_WH < 0.1) red('Batería del traje bajo 10%.')
  if (margin.level === 'ambar') amber(`Margen de regreso bajo (${margin.ratio.toFixed(2)}×). Planea volver.`)
  if (dem.visible && !comm) amber('Sin línea de vista con la base: sin comunicación directa.')
  if (sunElev < 0) amber('Es de noche: poca visibilidad y frío.')
  if (sand > 0.5) amber('Campo de dunas (USGS): arena suelta, riesgo de hundirse.')
  if (excursionKm > CONST.MAX_EXCURSION_KM) amber(`A ${excursionKm.toFixed(1)} km de la base (planificación: ${CONST.MAX_EXCURSION_KM} km).`)
  if (slope > 15) amber(`Pendiente fuerte (${slope.toFixed(0)}°): más esfuerzo y riesgo de caída.`)
  if (rad0 >= 1.5 && !env.flare) amber('Radiación elevada en esta zona.')
  const status = reasons.some((r) => r.level === 'rojo') ? 'rojo' : reasons.length ? 'ambar' : 'verde'

  return {
    mode: st.mode, dir: st.dir, s: st.s, length: geo.length, cell: p.cell, lonlat, elev: dem.elev[i], slope,
    heading: st.dir > 0 ? p.heading : (p.heading + 180) % 360,
    goal: { lonlat: goal, name: st.dir > 0 ? 'Destino' : shelter.name, distKm: remainingM / 1000, bearing: bearing(lonlat, goal), etaMin: (remainingM / 1000 / speed) * 60 },
    nextTurn: nextTurn && { ...nextTurn, inKm: (nextTurn.s - st.s) / 1000 },
    shelter, inShelter, base, start, end: endLL,
    clock: st.clock, sol: st.sol, hours: st.hours, speedKmh: speed,
    doseRate, rad0, doseMSv: st.doseMSv, flare: !!env.flare, tau,
    surfC: clim?.surfC ?? null, airC: clim?.airC ?? null, presPa, sunElev, comm, sand, excursionKm,
    o2LeftH, battLeftWh, battPct: (100 * battLeftWh) / EVA.BATTERY_WH, margin, status, reasons,
  }
}

/** Avanza el simulador dtH horas. Devuelve un estado nuevo y, si pasó algo, un aviso. */
export function step(dem, geo, st, env, dtH) {
  if (st.mode !== 'running') return { st }
  const t0 = readTelemetry(dem, geo, st, env)
  const speedMh = t0.speedKmh * 1000
  let s = st.s + st.dir * speedMh * dtH
  let mode = st.mode, event = null
  if (st.dir > 0 && s >= geo.length) { s = geo.length; mode = 'arrived'; event = 'Llegaste al destino. OK o "Volver" para regresar.' }
  if (st.dir < 0 && s <= 0) { s = 0; mode = 'returned'; event = 'De vuelta en el punto de salida. Consumibles recargados.' }

  // consumo metabólico de O2 según la pendiente del paso (Minetti): plano ≈ 1×, subida más
  const p1 = positionAt(dem, geo, s)
  const dz = dem.elev[p1.i] - dem.elev[t0.cell[1] * dem.w + t0.cell[0]]
  const dist = Math.abs(s - st.s)
  const o2Rate = Math.min(2.5, Math.max(0.6, dist > 0 ? effortRel(dz / dist) : 0.6))

  const doseInc = (t0.doseRate * dtH) / 24
  let clock = st.clock + dtH, sol = st.sol, log = st.log
  const solAcc = { ...st.solAcc, doseMSv: st.solAcc.doseMSv + doseInc, hours: st.solAcc.hours + dtH, evaH: st.solAcc.evaH + (t0.inShelter ? 0 : dtH), flare: st.solAcc.flare || t0.flare, dust: st.solAcc.dust || t0.tau >= 3 }
  let acc = solAcc
  if (clock >= 24) { clock -= 24; log = [...log, solEntry(sol, solAcc)]; sol += 1; acc = newSol() }

  const next = {
    ...st, s, mode, clock, sol, log, solAcc: acc,
    hours: st.hours + dtH,
    doseMSv: st.doseMSv + doseInc,
    o2UsedH: st.o2UsedH + o2Rate * dtH,
    battUsedWh: st.battUsedWh + EVA.SUIT_POWER_W * dtH,
  }
  if (mode === 'returned') { next.o2UsedH = 0; next.battUsedWh = 0; next.dir = 1 }
  return { st: next, event }
}

function solEntry(sol, a) {
  return {
    sol, condition: a.flare ? 'evento-solar' : a.dust ? 'tormenta-de-polvo' : 'gcr-normal', location: 'Gale (simulación)',
    equivalentMSvPerDay: a.hours > 0 ? +((a.doseMSv / a.hours) * 24).toFixed(3) : 0, evaHours: +a.evaH.toFixed(2),
  }
}
/** Soles cerrados más el sol en curso, para lib/radiationLog.js. */
export const solEntries = (st) => [...st.log, solEntry(st.sol, st.solAcc)]

/** Candidata de lib/routeEvaluator.js a partir de la ruta A* (ida y vuelta). */
export function routeCandidate(dem, geo) {
  let maxSlope = 0, maxShelter = 0
  const start = dem.lonLat(...geo.cells[0])
  const base = dem.baseCell ? dem.lonLat(...dem.baseCell) : null
  let radSum = 0
  for (const c of geo.cells) {
    const i = c[1] * dem.w + c[0]
    maxSlope = Math.max(maxSlope, dem.slope[i])
    radSum += radAt(dem, i)
    const ll = dem.lonLat(...c)
    maxShelter = Math.max(maxShelter, Math.min(distM(ll, start), base ? distM(ll, base) : Infinity))
  }
  return {
    candidate: { id: 'ruta', name: 'Ruta A* (ida y vuelta)', distanceKm: (2 * geo.length) / 1000, maxSlopeDeg: Math.round(maxSlope), maxDistanceToShelterKm: maxShelter / 1000 },
    meanRad: radSum / geo.cells.length,
  }
}

export { LIMITES }
