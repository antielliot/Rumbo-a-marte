import { useEffect, useRef } from 'react'
import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'
import { get as getProjection } from 'ol/proj'
import Map from 'ol/Map'
import { defaults as defaultInteractions } from 'ol/interaction/defaults'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import ImageStatic from 'ol/source/ImageStatic'
import VectorSource from 'ol/source/Vector'
import TileGrid from 'ol/tilegrid/TileGrid'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import { Style, Stroke, Circle as CircleStyle, Fill, RegularShape, Text } from 'ol/style'
import { isBlocked } from '../lib/route'
import { CONST } from '../lib/constants'
import { REASONS } from '../lib/explain'
import 'ol/ol.css'

// Marte 2000 geográfico (el CRS que usa Trek: EPSG:104905)
proj4.defs('EPSG:104905', '+proj=longlat +a=3396190 +b=3376200 +no_defs')
register(proj4)
const MARS = getProjection('EPSG:104905')
MARS.setExtent([-180, -90, 180, 90])

const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm'
const tileGrid = new TileGrid({
  origin: [-180, 90],
  resolutions: Array.from({ length: 8 }, (_, z) => 360 / 512 / 2 ** z),
  tileSize: 256,
})

const canvasFor = (dem) => {
  const c = document.createElement('canvas')
  c.width = dem.w
  c.height = dem.h
  const ctx = c.getContext('2d')
  return { c, ctx, img: ctx.createImageData(dem.w, dem.h) }
}

function heatUrl(dem, layer) {
  const { c, ctx, img } = canvasFor(dem)
  // todas las capas se expresan como riesgo 0..1 (azul = mejor, rojo = peor)
  const risk = layer === 'slope'
    ? Float32Array.from(dem.slope, (v) => Math.min(1, v / CONST.MAX_SLOPE_DEG)) // 1 = en el límite de A* o más
    : { rad: dem.radRisk, rough: dem.roughRisk, comm: dem.commRisk, shade: dem.shade, sand: dem.sandRisk }[layer]
  for (let i = 0; i < dem.n; i++) {
    const t = risk[i]
    if (Number.isNaN(t) || Number.isNaN(dem.elev[i])) continue
    img.data[i * 4] = 255 * t
    img.data[i * 4 + 1] = 80 * (1 - Math.abs(t - 0.5) * 2)
    img.data[i * 4 + 2] = 255 * (1 - t)
    img.data[i * 4 + 3] = 170
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

// Rojo = bloqueada por el filtro; gris = sin dato (fuera de la cobertura del DEM)
function maskCanvas(dem, filter) {
  const { c, ctx, img } = canvasFor(dem)
  for (let i = 0; i < dem.n; i++) {
    if (Number.isNaN(dem.elev[i])) {
      img.data.set([70, 70, 80, 200], i * 4)
    } else if (isBlocked(dem, i, filter)) {
      img.data.set([255, 40, 40, 140], i * 4)
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

// Relieve sombreado del propio DEM (luz desde el NO) teñido por altura
const RAMP = [[0, [45, 70, 120]], [0.35, [60, 130, 110]], [0.65, [190, 170, 90]], [1, [235, 225, 210]]]
function ramp(t) {
  for (let k = 1; k < RAMP.length; k++)
    if (t <= RAMP[k][0]) {
      const [t0, a] = RAMP[k - 1], [t1, b] = RAMP[k], f = (t - t0) / (t1 - t0)
      return a.map((v, q) => v + (b[q] - v) * f)
    }
  return RAMP[RAMP.length - 1][1]
}
function reliefUrl(dem) {
  const { c, ctx, img } = canvasFor(dem)
  const { w, h, elev, cellM, elevMin, elevMax } = dem
  const at = (x, y) => elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  const az = (315 * Math.PI) / 180, alt = (45 * Math.PI) / 180, vex = 2
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (Number.isNaN(elev[i])) continue
      const dzdx = (vex * (at(x + 1, y) - at(x - 1, y))) / (2 * cellM)
      const dzdy = (vex * (at(x, y + 1) - at(x, y - 1))) / (2 * cellM)
      const sl = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx)
      const shade = Math.max(0, Math.sin(alt) * Math.cos(sl) + Math.cos(alt) * Math.sin(sl) * Math.cos(az - asp))
      const col = ramp((elev[i] - elevMin) / (elevMax - elevMin))
      const k = 0.35 + 0.9 * shade
      img.data.set([col[0] * k, col[1] * k, col[2] * k, 255], i * 4)
    }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL()
}

const pt = (color) =>
  new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color }), stroke: new Stroke({ color: '#fff', width: 2 }) }) })

export default function MapView({ dem, layer, basemap, filter, route, start, end, onPick, curiosity, why, sel, onSelect, eva }) {
  const el = useRef(null)
  const ref = useRef({})
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const selRef = useRef(onSelect)
  selRef.current = onSelect

  useEffect(() => {
    const route = new VectorSource()
    const maskLayer = new ImageLayer({ opacity: 1 })
    const heatLayer = new ImageLayer({ opacity: 1 })
    const reliefLayer = new ImageLayer({ opacity: 1 })
    const map = new Map({
      target: el.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            projection: MARS,
            tileGrid,
            wrapX: false,
            crossOrigin: 'anonymous',
            tileUrlFunction: ([z, x, y]) => `${TREK}/${z}/${y}/${x}.jpg`,
            attributions: 'NASA Trek · MOLA',
          }),
        }),
        reliefLayer,
        heatLayer,
        maskLayer,
        new VectorLayer({
          source: route,
          style: (f) => {
            const k = f.get('kind')
            if (k === 'line') return new Style({ stroke: new Stroke({ color: '#22d3ee', width: 4 }) })
            if (k === 'straight') return new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,.7)', width: 2, lineDash: [6, 6] }) })
            if (k === 'why') {
              const on = f.get('selected')
              return new Style({
                zIndex: on ? 20 : 10,
                image: new CircleStyle({ radius: on ? 13 : 10, fill: new Fill({ color: f.get('color') }), stroke: new Stroke({ color: on ? '#fff' : '#0f172a', width: on ? 3 : 2 }) }),
                text: new Text({ text: String(f.get('n')), font: 'bold 11px sans-serif', fill: new Fill({ color: '#fff' }) }),
              })
            }
            if (k === 'alt') return [
              new Style({ stroke: new Stroke({ color: 'rgba(15,23,42,.8)', width: 6 }) }),
              new Style({ stroke: new Stroke({ color: '#f87171', width: 3, lineDash: [8, 6] }) }),
            ]
            if (k === 'hot') return new Style({ image: new RegularShape({ points: 4, radius: 9, radius2: 0, angle: Math.PI / 4, stroke: new Stroke({ color: '#f87171', width: 4 }) }) })
            if (k === 'eva-plan') return [
              new Style({ stroke: new Stroke({ color: 'rgba(15,23,42,.85)', width: 7 }) }),
              new Style({ stroke: new Stroke({ color: '#7dffb0', width: 3 }) }),
            ]
            if (k === 'astro') {
              const c = { verde: '#22c55e', ambar: '#f59e0b', rojo: '#ef4444' }[f.get('status')] ?? '#22c55e'
              return new Style({ zIndex: 30, image: new RegularShape({ points: 3, radius: 11, rotation: (f.get('heading') * Math.PI) / 180, fill: new Fill({ color: c }), stroke: new Stroke({ color: '#fff', width: 2 }) }) })
            }
            if (k === 'base') return new Style({ image: new RegularShape({ points: 3, radius: 9, fill: new Fill({ color: '#38bdf8' }), stroke: new Stroke({ color: '#fff', width: 2 }) }), text: new Text({ text: 'BASE', offsetY: 18, font: 'bold 11px sans-serif', fill: new Fill({ color: '#fff' }), stroke: new Stroke({ color: '#0f172a', width: 3 }) }) })
            return pt(k === 'start' ? '#22c55e' : '#f59e0b')
          },
        }),
      ],
      view: new View({ projection: MARS, center: [137.4, -4.6], resolution: 0.0012, minResolution: 360 / 512 / 2 ** 16 }),
      // arrastrar mueve el mapa; clic = inicio, segundo clic = destino (sin doble clic para zoom)
      interactions: defaultInteractions({ doubleClickZoom: false }),
    })
    // clic: si toca un marcador de giro lo selecciona; si no, fija inicio/destino
    const click = (e) => {
      const f = map.forEachFeatureAtPixel(e.pixel, (ft) => (ft.get('kind') === 'why' ? ft : null), { hitTolerance: 4 })
      if (f) return selRef.current?.(f.get('n'))
      pickRef.current('click', e.coordinate)
    }
    map.on('click', click)
    map.on('pointermove', (e) => { map.getViewport().style.cursor = map.hasFeatureAtPixel(e.pixel, { layerFilter: () => true, hitTolerance: 4 }) ? 'pointer' : '' })
    // recorrido real de Curiosity (referencia, independiente de nuestra ruta)
    const curSrc = new VectorSource()
    map.getLayers().insertAt(map.getLayers().getLength() - 1, new VectorLayer({ source: curSrc, style: [ // debajo de nuestra ruta
      new Style({ stroke: new Stroke({ color: 'rgba(15,23,42,.8)', width: 6 }) }),
      new Style({ stroke: new Stroke({ color: '#e879f9', width: 3 }) }),
    ] }))
    ref.current = { map, route, maskLayer, heatLayer, reliefLayer, curSrc }
    return () => {
      map.un('click', click)
      map.setTarget(undefined)
    }
  }, [])

  // máscara de filtro
  useEffect(() => {
    if (!dem) return
    ref.current.maskLayer.setSource(
      new ImageStatic({
        url: maskCanvas(dem, filter),
        projection: MARS,
        imageExtent: [dem.lonMin, dem.latMin, dem.lonMax, dem.latMax],
        interpolate: false,
      }),
    )
  }, [dem?.elev, dem?.slope, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  // relieve del DEM (solo se recalcula si cambia la malla base, no la radiación) + encuadre inicial
  const fitted = useRef(false)
  useEffect(() => {
    if (!dem) return
    const { reliefLayer, map } = ref.current
    reliefLayer.setSource(
      new ImageStatic({ url: reliefUrl(dem), projection: MARS, imageExtent: [dem.lonMin, dem.latMin, dem.lonMax, dem.latMax], interpolate: true }),
    )
    if (!fitted.current) {
      fitted.current = true
      map.getView().fit([dem.lonMin, dem.latMin, dem.lonMax, dem.latMax], { padding: [20, 20, 20, 20] })
    }
  }, [dem?.elev]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    ref.current.reliefLayer?.setVisible(basemap !== 'trek')
  }, [basemap])

  // capa de radiación
  useEffect(() => {
    if (!dem) return
    const { heatLayer } = ref.current
    if (layer === 'none') return heatLayer.setSource(null)
    heatLayer.setSource(
      new ImageStatic({
        url: heatUrl(dem, layer),
        projection: MARS,
        imageExtent: [dem.lonMin, dem.latMin, dem.lonMax, dem.latMax],
        interpolate: true,
      }),
    )
  }, [dem, layer])

  // ruta + marcadores
  useEffect(() => {
    if (!dem) return
    const src = ref.current.route
    src.clear()
    if (dem.baseCell) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...dem.baseCell)), kind: 'base' }))
    if (start && end)
      src.addFeature(new Feature({ geometry: new LineString([dem.lonLat(...start), dem.lonLat(...end)]), kind: 'straight' }))
    if (route) {
      const coords = route.cells.map(([x, y]) => dem.lonLat(x, y))
      src.addFeature(new Feature({ geometry: new LineString(coords), kind: 'line' }))
    }
    const it = why?.items.find((x) => x.n === sel)
    if (it) { // el atajo que A* descartó y, si lo hay, el punto donde estaría bloqueado
      src.addFeature(new Feature({ geometry: new LineString(it.shortcut.map((c) => dem.lonLat(...c))), kind: 'alt' }))
      if (it.hot) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...it.hot)), kind: 'hot' }))
    }
    // caminata de Rumbo Marte: plan congelado al salir y posición del astronauta
    if (eva) {
      src.addFeature(new Feature({ geometry: new LineString(eva.cells.map((c) => dem.lonLat(...c))), kind: 'eva-plan' }))
      src.addFeature(new Feature({ geometry: new Point(eva.lonlat), kind: 'astro', heading: eva.heading, status: eva.status }))
    }
    if (start) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...start)), kind: 'start' }))
    if (end) src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...end)), kind: 'end' }))
    for (const x of why?.items ?? [])
      src.addFeature(new Feature({ geometry: new Point(dem.lonLat(...x.at)), kind: 'why', n: x.n, color: REASONS[x.reason].color, selected: x.n === sel }))
  }, [dem, route, start, end, why, sel, eva?.lonlat?.[0], eva?.lonlat?.[1], eva?.status, eva?.cells]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const src = ref.current?.curSrc
    if (!src) return
    src.clear()
    if (!curiosity?.length) { ref.current.curFitted = false; return }
    const line = new LineString(curiosity)
    src.addFeature(new Feature({ geometry: line }))
    if (!ref.current.curFitted) { // acercar al recorrido solo la primera vez (no en cada cambio del recorte por sol)
      ref.current.map.getView().fit(line.getExtent(), { padding: [120, 120, 120, 120], duration: 400 })
      ref.current.curFitted = true
    }
  }, [curiosity])

  return <div ref={el} className="h-full w-full" />
}
