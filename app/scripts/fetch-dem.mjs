// DEM de TODO el cráter Gale a 200 m: USGS "Mars MGS MOLA - MEX HRSC Blended DEM Global 200m" v2.
// Lee solo la ventana del cráter del GeoTIFF global (int16, m, sin compresión, ~11 GB) con peticiones parciales (~1.4 MB).
// Salida: public/data/gale-dem.f32 (+ .json) y gale-rough.f32 (rugosidad a ~600 m), Float32 con NaN = sin dato.
// Uso: npm run fetch-dem
// Fuente: https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m
// (La versión de 1 m de la zona de Curiosity sigue disponible con: npm run fetch-dem-1m)
import { fromUrl } from 'geotiff'
import { writeFileSync, mkdirSync } from 'node:fs'

const URL_DEM = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif'
const BOX = { lonMin: 136.4, lonMax: 139.2, latMax: -4.0, latMin: -6.8 } // todo el cráter + borde
const R = 3396190

const tiff = await fromUrl(URL_DEM)
const img = await tiff.getImage()
const [res] = img.getResolution() // grados por píxel
const [ox, oy] = img.getOrigin()
const nodata = img.getGDALNoData()
const x0 = Math.round((BOX.lonMin - ox) / res), x1 = Math.round((BOX.lonMax - ox) / res)
const y0 = Math.round((oy - BOX.latMax) / res), y1 = Math.round((oy - BOX.latMin) / res)
const w = x1 - x0, h = y1 - y0
const bbox = [ox + x0 * res, oy - y1 * res, ox + x1 * res, oy - y0 * res]
const cellM = Math.round(res * ((Math.PI * R) / 180))
console.log(`ventana ${w}x${h} celdas de ~${cellM} m; bbox`, bbox.map((v) => v.toFixed(4)).join(', '))

const [raw] = await tiff.readRasters({ window: [x0, y0, x1, y1], samples: [0] }).then((r) => [r[0]])
const elev = new Float32Array(w * h)
for (let i = 0; i < elev.length; i++) elev[i] = raw[i] === nodata ? NaN : raw[i]

// Rugosidad: desviación estándar (m) de los residuos respecto a un plano ajustado en ventanas de 3x3 celdas (~600 m).
const rough = new Float32Array(w * h).fill(NaN)
for (let y = 1; y < h - 1; y++)
  for (let x = 1; x < w - 1; x++) {
    let n = 0, sz = 0, sx = 0, sy = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const z = elev[(y + dy) * w + x + dx]
      if (Number.isNaN(z)) { n = -1; break }
      n++; sz += z; sx += dx * z; sy += dy * z
    }
    if (n !== 9) continue
    // plano z = a + b·dx + c·dy en malla simétrica: b = Σdx·z/6, c = Σdy·z/6
    const b = sx / 6, c = sy / 6, mean = sz / 9
    let ss = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const e = elev[(y + dy) * w + x + dx] - (mean + b * dx + c * dy); ss += e * e }
    rough[y * w + x] = Math.sqrt(ss / 9)
  }

let min = Infinity, max = -Infinity, valid = 0
for (const v of elev) if (!Number.isNaN(v)) { valid++; if (v < min) min = v; if (v > max) max = v }
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../public/data/gale-dem.f32', import.meta.url), Buffer.from(elev.buffer))
writeFileSync(new URL('../public/data/gale-rough.f32', import.meta.url), Buffer.from(rough.buffer))
writeFileSync(
  new URL('../public/data/gale-dem.json', import.meta.url),
  JSON.stringify({ w, h, cellM, bbox, elevMin: Math.round(min), elevMax: Math.round(max), validFraction: valid / (w * h),
    source: 'USGS Mars MGS MOLA - MEX HRSC Blended DEM Global 200m v2, ventana del cráter Gale' }),
)
console.log(`OK ${w}x${h}; elevación ${min}..${max} m; con dato ${(100 * valid / (w * h)).toFixed(1)}%`)
