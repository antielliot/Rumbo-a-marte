// DEM de Gale a 1 m (USGS "Mars MSL Gale Merged DEM 1m", HiRISE+CTX+HRSC anclado a MOLA), zona de Curiosity.
// Lee el GeoTIFF remoto (3.6 GB) por filas con peticiones parciales y lo reduce a celdas de CELL_M metros
// promediando los píxeles de 1 m (ignorando nodata). Sale en binario Float32 (NaN = sin dato).
// También calcula la rugosidad por celda (gale50-rough.f32) a partir de los perfiles de 1 m.
// Uso: npm run fetch-dem   (varios minutos; ~300 MB de descarga)
// Fuente: https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m
// CRS del archivo: "Mars_Equirectangular_clon0" (esfera R=3396190 m): lon = x/R, lat = y/R.
import { fromUrl } from 'geotiff'
import { writeFileSync, mkdirSync } from 'node:fs'

const URL_DEM = 'https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif'
const CELL_M = 50 // tamaño de celda de salida (m)
const ROWS_PER_CELL = [13, 37] // filas de 1 m muestreadas dentro de cada bloque de 50 (promedio vertical parcial)
const CONCURRENCY = 16
const R = 3396190
const deg = (rad) => (rad * 180) / Math.PI

const tiff = await fromUrl(URL_DEM)
const img = await tiff.getImage()
const [xmin, , , ymax] = img.getBoundingBox()
const W = img.getWidth(), H = img.getHeight()
const nodata = img.getGDALNoData()
const w = Math.floor(W / CELL_M), h = Math.floor(H / CELL_M)
const bbox = [deg(xmin / R), deg(ymin / R), deg((xmin + w * CELL_M) / R), deg(ymax / R)]
bbox[1] = deg((ymax - h * CELL_M) / R)
console.log(`origen ${W}x${H} px (1 m) -> ${w}x${h} celdas de ${CELL_M} m; bbox lon/lat`, bbox.map((v) => v.toFixed(4)).join(', '))

const out = new Float32Array(w * h).fill(NaN)
const rough = new Float32Array(w * h).fill(NaN) // rugosidad: desviación estándar (m) de la altura a 1 m tras quitar la tendencia lineal en cada tramo de 50 m
let done = 0
async function doRow(j) {
  const sum = new Float64Array(w), cnt = new Uint16Array(w)
  const rs = new Float64Array(w), rn = new Uint8Array(w) // suma de desviaciones y nº de filas con tramo completo
  for (const off of ROWS_PER_CELL) {
    const y = j * CELL_M + off
    const [row] = await tiff.readRasters({ window: [0, y, W, y + 1], interleave: false })
    for (let i = 0; i < w; i++) {
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0
      for (let k = 0; k < CELL_M; k++) {
        const v = row[i * CELL_M + k]
        if (v === nodata || !Number.isFinite(v)) continue
        n++; sx += k; sy += v; sxx += k * k; sxy += k * v; syy += v * v
      }
      sum[i] += sy; cnt[i] += n
      if (n === CELL_M) {
        const Sxx = sxx - (sx * sx) / n, Sxy = sxy - (sx * sy) / n, Syy = syy - (sy * sy) / n
        rs[i] += Math.sqrt(Math.max(0, (Syy - (Sxy * Sxy) / Sxx) / n)); rn[i]++
      }
    }
  }
  const need = (ROWS_PER_CELL.length * CELL_M) / 2
  for (let i = 0; i < w; i++) {
    if (cnt[i] >= need) out[j * w + i] = sum[i] / cnt[i]
    if (rn[i] === ROWS_PER_CELL.length) rough[j * w + i] = rs[i] / rn[i]
  }
  if (++done % 100 === 0) console.log(`filas ${done}/${h}`)
}
const queue = Array.from({ length: h }, (_, j) => j)
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { for (let j; (j = queue.shift()) !== undefined; ) await doRow(j) }))

let min = Infinity, max = -Infinity, valid = 0
for (const v of out) if (!Number.isNaN(v)) { valid++; if (v < min) min = v; if (v > max) max = v }
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/data/gale50-dem.f32', import.meta.url), Buffer.from(out.buffer))
writeFileSync(new URL('../public/data/gale50-rough.f32', import.meta.url), Buffer.from(rough.buffer))
writeFileSync(
  new URL('../public/data/gale50-dem.json', import.meta.url),
  JSON.stringify({
    w, h, cellM: CELL_M, bbox, elevMin: Math.round(min), elevMax: Math.round(max), validFraction: valid / (w * h),
    source: 'USGS Mars MSL Gale Merged DEM 1m v3 (HiRISE+CTX+HRSC, MOLA-tied), promediado a celdas de ' + CELL_M + ' m',
  }),
)
console.log(`OK ${w}x${h}; elevación real ${min.toFixed(0)}..${max.toFixed(0)} m; con dato: ${(100 * valid / (w * h)).toFixed(1)}%`)
