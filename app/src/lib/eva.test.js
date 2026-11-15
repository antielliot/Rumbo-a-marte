import { describe, expect, it } from 'vitest'
import { EVA, initialState, readTelemetry, routeGeometry, step, routeCandidate, climateAt, bearing } from './eva.js'
import { CONST } from './constants.js'

// Malla plana de 1 × 40 celdas de 200 m (8 km) al este de la base, con radiación de superficie normal.
function flatDem(rad = 0.67) {
  const w = 40, h = 1, n = w * h, cellM = 200
  const dLon = cellM / ((2 * Math.PI * 3396190) / 360)
  const dem = {
    w, h, n, cellM, elev: new Float32Array(n).fill(-4400), slope: new Float32Array(n), rad: new Float32Array(n).fill(rad),
    visible: new Uint8Array(n).fill(1), sandRisk: new Float32Array(n), baseCell: [0, 0],
    lonLat: (x) => [137.44 + (x + 0.5) * dLon, -4.59],
  }
  const route = { cells: Array.from({ length: w }, (_, x) => [x, 0]) }
  return { dem, route }
}
const env = { flare: false, dustTau: 0.5, ls: 90, temp: null }

describe('simulador de EVA', () => {
  it('camina a la velocidad del proyecto y llega al destino', () => {
    const { dem, route } = flatDem()
    const geo = routeGeometry(dem, route, null)
    let st = { ...initialState(10), mode: 'running' }
    let event = null
    for (let k = 0; k < 400 && st.mode === 'running'; k++) ({ st, event } = step(dem, geo, st, env, 0.01))
    expect(st.mode).toBe('arrived')
    expect(event).toMatch(/destino/)
    const expectedH = geo.length / 1000 / (CONST.WALK_KMH / (1 + 0.1 * 0.5))
    expect(st.hours).toBeGreaterThan(expectedH - 0.02)
    expect(st.hours).toBeLessThan(expectedH + 0.02)
  })

  it('la tormenta solar pone el estado en rojo fuera del refugio y no dentro', () => {
    const { dem, route } = flatDem()
    const geo = routeGeometry(dem, route, null)
    const out = readTelemetry(dem, geo, { ...initialState(), s: 4000 }, { ...env, flare: true })
    expect(out.doseRate).toBeCloseTo(0.67 * EVA.SPE_FACTOR, 2)
    expect(out.status).toBe('rojo')
    const home = readTelemetry(dem, geo, { ...initialState(), s: 0 }, { ...env, flare: true })
    expect(home.inShelter).toBe(true)
    expect(home.doseRate).toBeLessThan(EVA.RED_DOSE_MSV_DAY)
  })

  it('el margen de regreso cae a rojo cuando el O2 no alcanza para volver', () => {
    const { dem, route } = flatDem()
    const geo = routeGeometry(dem, route, null)
    const t = readTelemetry(dem, geo, { ...initialState(), s: 7000, o2UsedH: EVA.O2_H - 2.5 }, env)
    expect(t.margin.level).toBe('rojo')
    expect(t.reasons[0].text).toMatch(/no retorno/)
  })

  it('al volver al punto de salida recarga O2 y batería', () => {
    const { dem, route } = flatDem()
    const geo = routeGeometry(dem, route, null)
    let st = { ...initialState(), mode: 'running', dir: -1, s: 300, o2UsedH: 3, battUsedWh: 200 }
    let event
    for (let k = 0; k < 50 && st.mode === 'running'; k++) ({ st, event } = step(dem, geo, st, env, 0.01))
    expect(st.mode).toBe('returned')
    expect(st.o2UsedH).toBe(0)
    expect(event).toMatch(/recargados/)
  })

  it('arma la candidata de ida y vuelta para el evaluador de rutas', () => {
    const { dem, route } = flatDem()
    const { candidate } = routeCandidate(dem, routeGeometry(dem, route, null))
    expect(candidate.distanceKm).toBeCloseTo((2 * 39 * 200) / 1000, 5)
  })

  it('funciona con una malla mínima (sin rad, visible, dunas ni base), como la del motor GeoTIFF', () => {
    const { dem, route } = flatDem()
    for (const k of ['rad', 'visible', 'sandRisk', 'baseCell']) delete dem[k]
    const t = readTelemetry(dem, routeGeometry(dem, route, null), { ...initialState(), s: 1000 }, env)
    expect(t.rad0).toBeCloseTo(0.64, 2)
    expect(t.status).toBe('verde')
  })

  it('interpola la MCD entre horas y calcula rumbos', () => {
    const temp = { table: { 90: { 10: { surf: 273.15, air: 263.15, pres: 800 }, 12: { surf: 283.15, air: 273.15, pres: 820 } } } }
    const c = climateAt(temp, 90, 11)
    expect(c.surfC).toBeCloseTo(5, 5)
    expect(c.presPa).toBeCloseTo(810, 5)
    expect(bearing([137, -4.6], [137.1, -4.6])).toBeCloseTo(90, 0)
  })
})
