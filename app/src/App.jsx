import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from './components/MapView'
import ElevationProfile from './components/ElevationProfile'
import TemperatureCard from './components/TemperatureCard'
import DataPanel from './components/DataPanel'
import { loadDem } from './lib/dem'
import { radiationFor, SOLAR } from './lib/radiation'
import { loadTemp, SEASONS } from './lib/temperature'
import { shadeMap } from './lib/sun'
import { effortRel } from './lib/effort'
import { CONST } from './lib/constants'
import { findRoute, isBlocked } from './lib/route'
import { explainRoute, REASONS } from './lib/explain'
import { loadCuriosity, compareRoutes, cutAtSol, solDate } from './lib/curiosity'
// Rumbo Marte: caminata simulada, reloj OLED de 4 botones, visor HUD, seguridad y traje
import { useEva } from './lib/useEva'
import { routeCandidate } from './lib/eva'
import { evaluateRoutes, DEFAULT_SETTINGS } from './lib/routeEvaluator'
import Watch from './components/eva/Watch'
import Hud from './components/eva/Hud'
import EvaPanel from './components/eva/EvaPanel'
import SuitPanel from './components/eva/SuitPanel'
import './components/eva/eva.css'

// Pesos fijos de la ruta (ya no son controles): siempre se minimizan esfuerzo, radiación y rugosidad y se mantiene comunicación.
// 'Sol' queda en 0: no aporta seguridad (no modelamos calor/energía) y la sombra sigue disponible como capa.
const W = { effort: 1, rad: 2, rough: 1, comm: 1, sand: 1 }
// Modo comparación con Curiosity: solo relieve (esfuerzo por subidas/bajadas y el bloqueo por pendiente > 20°).
const W_RELIEF = { effort: 1, rad: 0, rough: 0, comm: 0, sand: 0 }
const LAYERS = [
  ['none', 'Ninguna'],
  ['rad', 'Radiación (rojo = más dosis)'],
  ['rough', 'Rugosidad (rojo = más rugoso)'],
  ['comm', 'Comunicación (rojo = sin vista a la base)'],
  ['shade', 'Sombra (rojo = en sombra)'],
  ['sand', 'Campos de dunas USGS (rojo = dunas)'],
  ['slope', `Pendiente (rojo = ${CONST.MAX_SLOPE_DEG}° o más)`],
]
// Qué tan real es cada capa (se muestra bajo el selector)
const LAYER_SOURCE = {
  rad: 'Modelo anclado en MSL/RAD y HZETRN2015 (Guo et al. 2018), con la presión de la MCD.',
  rough: 'Dato real: desviación del DEM USGS (MOLA–HRSC) en ventanas de ~600 m, relativa a la zona.',
  comm: 'Modelo: línea de vista desde la base sobre el DEM, con la curvatura de Marte.',
  shade: 'Modelo: posición del Sol y sombras del DEM (solo visual).',
  sand: 'Dato real: contorno de campos de dunas del USGS (MGD3).',
  slope: 'Dato real: pendiente del DEM USGS (MOLA–HRSC). A partir del límite, A* la bloquea.',
}
// Cima del Monte Sharp (Aeolis Mons): máximo del DEM cerca de 5.08°S, 137.85°E
function aeolisMons(dem) {
  const c = dem.cellOf(137.85, -5.08)
  if (!c) return null
  const r = Math.round(25000 / dem.cellM)
  let best = null, z = -Infinity
  for (let y = Math.max(0, c[1] - r); y < Math.min(dem.h, c[1] + r); y++)
    for (let x = Math.max(0, c[0] - r); x < Math.min(dem.w, c[0] + r); x++) {
      const v = dem.elev[y * dem.w + x]
      if (v > z) { z = v; best = [x, y] }
    }
  return best && { id: 'aeolis', name: 'Cima Monte Sharp', lonlat: dem.lonLat(...best) }
}

const Select = (props) => <select {...props} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm" />
const Title = ({ children }) => <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h2>

export default function App() {
  const [craterDem, setDem] = useState(null) // cráter completo, 200 m
  const [detailDem, setDetailDem] = useState(null) // zona de Curiosity, 50 m (del DEM de 1 m)
  const [temp, setTemp] = useState(null)
  const [error, setError] = useState(null)
  const [solar, setSolar] = useState('mid')
  const [ls, setLs] = useState(90)
  const [hour, setHour] = useState(12)
  const [maxElevSel, setMaxElevSel] = useState(null)
  const [bench, setBench] = useState(false) // comparar con el recorrido real de Curiosity
  const [curiosity, setCuriosity] = useState(null)
  const [benchRes, setBenchRes] = useState('detail') // DEM usado en la comparación
  const [benchSand, setBenchSand] = useState(false) // en la comparación: además del relieve, evitar dunas (USGS)
  const [solIdx, setSolIdx] = useState(null) // recorte del recorrido de Curiosity (índice en curiosity.sols; null = último)
  const w = useMemo(() => (bench ? { ...W_RELIEF, sand: benchSand ? 1 : 0 } : W), [bench, benchSand])
  const useDetail = bench && benchRes === 'detail'
  const baseDem = useDetail ? detailDem : craterDem
  const [basemap, setBasemap] = useState('relief')
  const [layer, setLayer] = useState('none')
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [showData, setShowData] = useState(false)
  const [flare, setFlare] = useState(false) // tormenta solar (manual o confirmada con DONKI)
  const [dustTau, setDustTau] = useState(null) // null = sin tormenta de polvo (τ climatológico ~0.5)
  const [hud, setHud] = useState(false)

  useEffect(() => { loadDem().then(setDem).catch((e) => setError(e.message)) }, [])
  useEffect(() => { loadTemp().then(setTemp).catch((e) => setError(e.message)) }, [])
  useEffect(() => { if (useDetail && !detailDem) loadDem('gale50').then(setDetailDem).catch((e) => setError(e.message)) }, [useDetail, detailDem])
  // al cambiar de DEM las celdas no coinciden: se reinicia la ruta
  useEffect(() => { setStart(null); setEnd(null) }, [baseDem])
  useEffect(() => { if (bench && !curiosity) loadCuriosity().then(setCuriosity).catch((e) => setError(e.message)) }, [bench, curiosity])

  // sombras: solo se calculan si se mira esa capa (no entran en la ruta); dependen de la estación y la hora
  const shade = useMemo(() => (baseDem && layer === 'shade' ? shadeMap(baseDem, ls, hour) : null), [baseDem, layer, ls, hour])
  // radiación: depende de la actividad solar y de la presión real (MCD) de la estación/hora
  const dem = useMemo(() => {
    if (!baseDem) return null
    let atm = null
    const p = temp?.table[ls]?.[hour]?.pres
    if (p) {
      const c = baseDem.cellOf(temp.point.lon, temp.point.lat)
      const z = c ? baseDem.elev[c[1] * baseDem.w + c[0]] : NaN
      if (Number.isFinite(z)) atm = { pressure: p, elev: z }
    }
    return { ...baseDem, ...radiationFor(baseDem, SOLAR[solar].phi, atm), shade }
  }, [baseDem, solar, temp, ls, hour, shade])

  const maxElev = maxElevSel ?? (baseDem ? Math.round((baseDem.elevMin + 0.75 * (baseDem.elevMax - baseDem.elevMin)) / 50) * 50 : 0)
  // en comparación no hay filtro de altura: solo cuenta el relieve
  const filter = useMemo(() => ({ maxElev: bench ? Infinity : maxElev, maxSlope: CONST.MAX_SLOPE_DEG }), [maxElev, bench])

  // Un solo cálculo A* a la vez y siempre con el último destino (los movimientos intermedios no se acumulan).
  const [rawRoute, setRoute] = useState(null)
  const [why, setWhy] = useState(null) // explicación de los giros de la ruta actual
  const [sel, setSel] = useState(null) // giro seleccionado
  const [computing, setComputing] = useState(false)
  const job = useRef({ busy: false, again: false, args: null })
  useEffect(() => {
    const j = job.current
    if (!dem || !start || !end) { setRoute(null); setWhy(null); setSel(null); return }
    j.args = { dem, start, end, filter, w }
    if (j.busy) { j.again = true; return }
    const run = () => {
      j.busy = true
      setComputing(true)
      setTimeout(() => {
        const a = j.args
        const r = findRoute(a.dem, a.start, a.end, a.filter, a.w)
        if (r) r.elev = a.dem.elev // malla con la que se calculó
        setRoute(r)
        setWhy(r ? explainRoute(a.dem, r, a.w, a.filter) : null) // mismos datos y pesos que A*
        setSel(null)
        j.busy = false
        if (j.again) { j.again = false; run() } else setComputing(false)
      }, 0)
    }
    run()
  }, [dem, start, end, filter, w])
  // la ruta solo vale para el DEM con el que se calculó (al cambiar de DEM se descarta)
  const route = rawRoute && dem && rawRoute.elev === dem.elev ? rawRoute : null
  const noRoute = start && end && !computing && !route

  // ---------- Rumbo Marte: caminata simulada sobre la ruta A* ----------
  const tempElev = useMemo(() => {
    if (!baseDem || !temp) return undefined
    const c = baseDem.cellOf(temp.point.lon, temp.point.lat)
    const z = c ? baseDem.elev[c[1] * baseDem.w + c[0]] : NaN
    return Number.isFinite(z) ? z : undefined
  }, [baseDem, temp])
  const eva = useEva({ dem, route, why, temp, ls, hour, onHour: setHour, flare, dustTau, tempElev })
  const t = eva.t
  // veredicto del evaluador de rutas del equipo sobre esta ruta (ida y vuelta) con el polvo y el clima espacial actuales
  const verdict = useMemo(() => {
    if (!dem || !eva.geo || !t) return null
    const { candidate, meanRad } = routeCandidate(dem, eva.geo)
    const r = evaluateRoutes([candidate], { dustTau: t.tau, solarEventActive: flare }, { ...DEFAULT_SETTINGS, surfaceDoseMSvPerDay: meanRad })
    return { ev: r.evaluations[0], reason: r.reason }
  }, [dem, eva.geo, t?.tau, flare]) // eslint-disable-line react-hooks/exhaustive-deps
  // referencias para la cinta del HUD: cima del Monte Sharp (DEM), base y última posición de Curiosity
  const [curLast, setCurLast] = useState(null)
  useEffect(() => { if (hud && !curLast) loadCuriosity().then((c) => setCurLast(c.sols[c.sols.length - 1])).catch(() => {}) }, [hud, curLast])
  const landmarks = useMemo(() => {
    if (!dem) return []
    const out = []
    const m = aeolisMons(dem)
    if (m) out.push(m)
    if (dem.baseCell) out.push({ id: 'base', name: 'Base Bradbury', lonlat: dem.lonLat(...dem.baseCell) })
    if (curLast) out.push({ id: 'msl', name: `Curiosity (sol ${curLast[0]})`, lonlat: [curLast[2], curLast[3]] })
    return out
  }, [dem?.elev, curLast]) // eslint-disable-line react-hooks/exhaustive-deps
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!eva.event) return
    setToast(eva.event.text)
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [eva.event])

  // clic 1 = inicio, clic 2 = destino (A* y la explicación se calculan una sola vez); un tercer clic empieza otra ruta
  const onPick = (phase, [lon, lat]) => {
    if (!dem) return
    const c = dem.cellOf(lon, lat)
    if (!c) return
    if (!start || end) { setStart(c); setEnd(null) }
    else setEnd(c)
  }
  const blockedEnd = dem && start && end && (isBlocked(dem, start[1] * dem.w + start[0], filter) || isBlocked(dem, end[1] * dem.w + end[0], filter))

  const stats = useMemo(() => {
    if (!route) return null
    const { cells } = route
    const speed = CONST.WALK_KMH * 1000 // m/h
    const idx = (c) => c[1] * dem.w + c[0]
    let seg = 0, eff = 0, dose = 0, vis = 0, minE = Infinity, maxE = -Infinity, maxExc = 0
    cells.forEach((c, k) => {
      const i = idx(c)
      minE = Math.min(minE, dem.elev[i]); maxE = Math.max(maxE, dem.elev[i])
      if (dem.visible[i]) vis++
      if (dem.baseCell) maxExc = Math.max(maxExc, Math.hypot(c[0] - dem.baseCell[0], c[1] - dem.baseCell[1]) * dem.cellM)
      if (k) {
        const p = cells[k - 1]
        const d = Math.hypot(c[0] - p[0], c[1] - p[1]) * dem.cellM
        seg += d
        eff += effortRel((dem.elev[i] - dem.elev[idx(p)]) / d) * d
        dose += (dem.rad[i] / 24) * (d / speed) // mSv/día -> mSv/h × horas en la celda
      }
    })
    const timeH = seg / speed
    // temperatura de superficie durante la salida (la tabla de la MCD es cada 2 h)
    let tMin = null, tMax = null
    if (temp) {
      for (let t = 0; t <= Math.ceil(timeH / 2) * 2; t += 2) {
        const hh = (Math.floor(hour / 2) * 2 + t) % 24
        const v = temp.table[ls][hh].surf
        tMin = tMin === null ? v : Math.min(tMin, v)
        tMax = tMax === null ? v : Math.max(tMax, v)
      }
    }
    return {
      km: route.distanceKm, timeH, doseMsv: dose, effortRel: seg ? eff / seg : 1,
      visPct: (100 * vis) / cells.length, min: Math.round(minE), max: Math.round(maxE), maxExcKm: maxExc / 1000, tMin, tMax,
    }
  }, [route, dem, temp, ls, hour])

  const solList = curiosity?.sols ?? []
  const solSel = solList.length ? solList[solIdx ?? solList.length - 1][0] : null
  const curCut = useMemo(() => (curiosity ? cutAtSol(curiosity, solSel) : null), [curiosity, solSel])
  const cmp = useMemo(() => {
    if (!bench || !curCut || !route || !dem) return null
    const ours = route.cells.map(([x, y]) => dem.lonLat(x, y))
    return compareRoutes(ours, curCut.coords)
  }, [bench, curCut, route, dem])
  const useCuriosityEnds = () => {
    if (!dem || !curCut) return
    const a = curCut.coords[0], b = curCut.coords[curCut.coords.length - 1]
    setStart(dem.cellOf(a[0], a[1])); setEnd(dem.cellOf(b[0], b[1]))
  }

  const warnings = []
  if (stats) {
    if (stats.maxExcKm > CONST.MAX_EXCURSION_KM) warnings.push(`Se aleja ${stats.maxExcKm.toFixed(1)} km de la base (planificación: ${CONST.MAX_EXCURSION_KM} km).`)
    if (stats.tMin !== null && (stats.tMin < CONST.SUIT_EXT_K[0] || stats.tMax > CONST.SUIT_EXT_K[1])) warnings.push('La temperatura sale del rango externo de diseño del traje (lunar).')
    if (stats.visPct < 100) warnings.push(`${(100 - stats.visPct).toFixed(0)}% del recorrido sin línea de vista a la base.`)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-white/10 bg-[#0a0f1a] p-5 md:w-80 md:overflow-y-auto md:border-b-0 md:border-r">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-cyan-300">Mars Route</h1>
            <p className="text-xs text-slate-500">Gale · navegación EVA</p>
          </div>
          <button className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => setShowData(true)}>Datos considerados</button>
        </header>

        <section>
          <Title>Escenario</Title>
          <div className="space-y-4">
            <TemperatureCard temp={temp} ls={ls} hour={hour} setHour={setHour} />
          </div>
        </section>

        <section>
          <Title>Ruta</Title>
          <label className="mb-4 block text-sm">
            <div className="flex items-baseline justify-between"><span className="text-slate-400">Altura máxima</span><b className="text-base text-cyan-300">{maxElev} m</b></div>
            <input type="range" className="mt-1 w-full accent-cyan-400" min={baseDem?.elevMin ?? -4500} max={baseDem?.elevMax ?? 0} step={50} value={maxElev} onChange={(e) => setMaxElevSel(+e.target.value)} />
          </label>
          <p className="text-sm text-slate-400">Haz clic en el <b className="text-green-400">inicio</b> y luego en el <b className="text-amber-400">destino</b>. <span className="text-slate-500">Arrastrar mueve el mapa.</span></p>
          {noRoute && <p className="mt-2 text-sm text-red-400">{blockedEnd ? 'El inicio o el destino cae en zona bloqueada.' : 'No hay camino con estos límites. Sube la altura máxima.'}</p>}
          {stats && (
            <div className="mt-3 space-y-1.5">
              {stats.tMin !== null && <p className="text-xs text-slate-400">Superficie durante la salida: {(stats.tMin - 273.15).toFixed(0)} a {(stats.tMax - 273.15).toFixed(0)} °C</p>}
              {warnings.map((m) => <p key={m} className="rounded-md bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-300">{m}</p>)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {dem?.baseCell && <button className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => { setStart(dem.baseCell); setEnd(null) }}>Salir desde la base</button>}
            {(start || end) && <button className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10" onClick={() => { setStart(null); setEnd(null) }}>Reiniciar</button>}
          </div>
        </section>

        {route && why && (
          <section>
            <Title>Por qué esta ruta</Title>
            {why.items.length === 0 ? (
              <p className="text-sm text-slate-400">Va prácticamente derecho: ningún desvío importante.</p>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {Object.entries(why.summary).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                    <span key={k} className="rounded-full px-2 py-0.5 text-[11px] text-white" style={{ background: REASONS[k].color + 'cc' }}>{REASONS[k].icon} {REASONS[k].label} ×{n}</span>
                  ))}
                </div>
                <ol className="space-y-1.5">
                  {why.items.map((it) => (
                    <li key={it.n}>
                      <button onClick={() => setSel(sel === it.n ? null : it.n)} className={`flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-xs ${sel === it.n ? 'bg-white/15 text-slate-100' : 'text-slate-300 hover:bg-white/5'}`}>
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: REASONS[it.reason].color }}>{it.n}</span>
                        <span>{it.text}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-slate-500">Toca un número (aquí o en el mapa) para ver en rojo el camino recto que se descartó.</p>
              </>
            )}
          </section>
        )}

        <section className="shrink-0">
          <Title>Perfil de elevación</Title>
          <div className="h-40">{dem && <ElevationProfile dem={dem} route={route} />}</div>
        </section>

        <section>
          <Title>Comparar con Curiosity</Title>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-fuchsia-400" checked={bench} onChange={(e) => setBench(e.target.checked)} />
            Mostrar recorrido real de Curiosity
          </label>
          {bench && (
            <div className="mt-3 space-y-3 text-xs text-slate-400">
              <p>Nuestra ruta usa <b className="text-slate-200">solo el relieve</b> (subidas y el límite de {CONST.MAX_SLOPE_DEG}°). El recorrido de Curiosity solo se dibuja: no influye en nuestra ruta.</p>
              {curCut && solSel !== null && (
                <label className="block">
                  <div className="flex items-baseline justify-between"><span>Curiosity hasta el sol <b className="text-fuchsia-300">{solSel}</b></span><span>{solDate(solSel).toLocaleDateString('es', { year: 'numeric', month: 'short' })} · {curCut.km.toFixed(1)} km</span></div>
                  <input type="range" className="mt-1 w-full accent-fuchsia-400" min={0} max={solList.length - 1} value={solIdx ?? solList.length - 1} onChange={(e) => setSolIdx(+e.target.value)} />
                </label>
              )}
              <label className="block"><span>Relieve (DEM)</span>
                <Select value={benchRes} onChange={(e) => setBenchRes(e.target.value)}>
                  <option value="detail">50 m · zona de Curiosity (DEM de 1 m)</option>
                  <option value="crater">200 m · cráter completo</option>
                </Select>
              </label>
              <label className="flex items-center gap-2"><input type="checkbox" className="accent-amber-400" checked={benchSand} onChange={(e) => setBenchSand(e.target.checked)} /> Evitar campos de dunas (USGS)</label>
              <button className="rounded-md border border-white/15 px-3 py-1 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40" disabled={!curCut || !dem} onClick={useCuriosityEnds}>Usar su inicio y su posición en ese sol</button>
              {cmp && (
                <dl className="grid grid-cols-2 gap-2 rounded-md bg-white/5 px-3 py-2">
                  <div><dt>Distancia media a Curiosity</dt><dd className="text-base text-cyan-300">{(cmp.meanM / 1000).toFixed(2)} km</dd></div>
                  <div><dt>Distancia máxima</dt><dd className="text-base text-cyan-300">{(cmp.maxM / 1000).toFixed(2)} km</dd></div>
                  <div><dt>Ruta a &lt; {cmp.tolM} m de Curiosity</dt><dd className="text-base text-cyan-300">{cmp.within.toFixed(0)}%</dd></div>
                  <div><dt>Largo: nuestra / Curiosity</dt><dd className="text-base text-cyan-300">{route.distanceKm.toFixed(1)} / {curCut.km.toFixed(1)} km</dd></div>
                </dl>
              )}
              <p className="text-[11px] text-slate-500">Curiosity no buscó el camino más corto: se desvió por objetivos científicos, arena y daño a las ruedas. Es un benchmark aproximado.</p>
            </div>
          )}
        </section>

        <details className="shrink-0 text-sm">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">Mapa</summary>
          <div className="mt-3 space-y-3">
            <label className="block"><span className="text-slate-400">Mapa base</span>
              <Select value={basemap} onChange={(e) => setBasemap(e.target.value)}>
                <option value="relief">Relieve del DEM</option>
                <option value="trek">NASA Trek (MOLA)</option>
              </Select>
            </label>
            <label className="block"><span className="text-slate-400">Capa</span>
              <Select value={layer} onChange={(e) => setLayer(e.target.value)}>
                {LAYERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </Select>
            </label>
            {LAYER_SOURCE[layer] && <p className="text-[11px] text-slate-500">{LAYER_SOURCE[layer]}</p>}
            <p className="text-[11px] text-slate-500"><span className="text-red-300/80">■</span> bloqueado (muy alto o &gt;{CONST.MAX_SLOPE_DEG}°) · <span className="text-slate-400">■</span> sin dato · <span className="text-sky-300">▲</span> base</p>
          </div>
        </details>
        <details className="shrink-0 text-sm">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">Opciones</summary>
          <div className="mt-3 space-y-3">
            <label className="block"><span className="text-slate-400">Estación</span>
              <Select value={ls} onChange={(e) => setLs(+e.target.value)}>
                {(temp?.ls ?? [ls]).map((v) => <option key={v} value={v}>{SEASONS[v]}</option>)}
              </Select>
            </label>
            <label className="block"><span className="text-slate-400">Actividad solar</span>
              <Select value={solar} onChange={(e) => setSolar(e.target.value)}>
                {Object.entries(SOLAR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </label>
          </div>
        </details>
      </aside>

      <main className="relative h-[70vh] shrink-0 md:h-auto md:min-h-0 md:flex-1 md:shrink">
        {error && <div className="absolute z-10 m-3 rounded bg-red-900 p-3 text-sm">{error}</div>}
        {stats && (
          <dl className="absolute right-3 top-3 z-10 grid grid-cols-3 gap-x-4 rounded-lg border border-white/10 bg-[#0a0f1a]/90 px-3 py-2 backdrop-blur">
            {[
              ['Distancia', `${stats.km.toFixed(1)} km`],
              ['Tiempo a pie', `${stats.timeH.toFixed(1)} h`],
              ['Elevación', `${stats.min} a ${stats.max} m`],
            ].map(([k, v]) => <div key={k}><dt className="text-[11px] text-slate-400">{k}</dt><dd className="text-base text-cyan-300">{v}</dd></div>)}
          </dl>
        )}
        {toast && <div role="status" className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-md border border-white/15 bg-[#0a0f1a]/95 px-4 py-2 text-sm text-slate-100 shadow-lg">{toast}</div>}
        <MapView eva={eva.plan && t ? { cells: eva.plan.route.cells, lonlat: t.lonlat, heading: t.heading, status: t.status } : null}
          curiosity={bench ? curCut?.coords : null} dem={dem} layer={layer} basemap={basemap} filter={filter} route={route} start={start} end={end} onPick={onPick} why={route ? why : null} sel={sel} onSelect={(n) => setSel((s) => (s === n ? null : n))} />
      </main>

      <aside className="flex w-full shrink-0 flex-col gap-6 border-t border-white/10 bg-[#0a0f1a] p-5 md:w-[384px] md:overflow-y-auto md:border-l md:border-t-0" aria-label="Caminata: reloj, seguridad y traje">
        <Watch t={t} turns={eva.geo?.turns ?? []} mode={eva.st.mode} accel={eva.accel} controls={eva.controls} hudOpen={hud} onHud={() => setHud((v) => !v)} />
        <EvaPanel t={t} st={eva.st} eva={eva} flare={flare} setFlare={setFlare} dustTau={dustTau} setDustTau={setDustTau} verdict={verdict} onHud={() => setHud(true)} />
        <SuitPanel t={t} />
      </aside>
      {hud && <Hud t={t} landmarks={landmarks} onClose={() => setHud(false)} onShelter={() => { eva.controls.goShelter() }} />}

      {showData && (
        <DataPanel onClose={() => setShowData(false)}
          state={{ w, maxElev, solar, ls, hour, temp, stats, elevMin: baseDem?.elevMin, elevMax: baseDem?.elevMax }} />
      )}
    </div>
  )
}
