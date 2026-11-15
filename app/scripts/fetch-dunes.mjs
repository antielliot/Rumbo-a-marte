// Campos de dunas de Gale: USGS "Mars Global Digital Dune Database" (MGD3), Hayward et al. 2007, Open-File Report 2007-1158.
// Descarga el GML del USGS (~3.5 MB), extrae Dune_Field.gml con `unzip` del sistema y guarda los polígonos que caen
// en la ventana del cráter. Coordenadas geocéntricas (GCS_Mars_2000), longitud este.
// Salida: public/data/gale-dunes.json (GeoJSON). Uso: npm run fetch-dunes
// Fuente: https://pubs.usgs.gov/of/2007/1158/
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_GML = 'https://pubs.usgs.gov/of/2007/1158/GML.zip'
const BOX = { lonMin: 136.4, lonMax: 139.2, latMin: -6.8, latMax: -4.0 } // igual que fetch-dem

const dir = mkdtempSync(join(tmpdir(), 'mgd3-'))
try {
  const res = await fetch(URL_GML)
  if (!res.ok) throw new Error(`descarga falló: ${res.status}`)
  writeFileSync(join(dir, 'gml.zip'), Buffer.from(await res.arrayBuffer()))
  execFileSync('unzip', ['-o', '-q', join(dir, 'gml.zip'), 'GML/Dune_Field.gml', '-d', dir])
  const gml = readFileSync(join(dir, 'GML', 'Dune_Field.gml'), 'utf8')

  const tag = (s, name) => s.match(new RegExp(`<ogr:${name}>([^<]*)</ogr:${name}>`))?.[1]?.trim()
  const features = []
  for (const [, f] of gml.matchAll(/<gml:featureMember>([\s\S]*?)<\/gml:featureMember>/g)) {
    // todos los anillos (exteriores e interiores); se rellenan con la regla par-impar
    const rings = [...f.matchAll(/<gml:coordinates>([^<]*)<\/gml:coordinates>/g)].map(([, c]) =>
      c.trim().split(/\s+/).map((p) => p.split(',').slice(0, 2).map(Number)))
    const pts = rings.flat()
    const inBox = pts.some(([lon, lat]) => lon >= BOX.lonMin && lon <= BOX.lonMax && lat >= BOX.latMin && lat <= BOX.latMax)
    if (!inBox) continue
    features.push({
      type: 'Feature',
      properties: {
        id: tag(f, 'Dune_ID'), type: tag(f, 'Dune_Type'), confidence: Number(tag(f, 'Confidence')),
        areaKm2: Number(Number(tag(f, 'Area_sinu_')).toFixed(1)), comment: tag(f, 'Comments_1'),
      },
      geometry: { type: 'Polygon', coordinates: rings.map((r) => r.map(([lon, lat]) => [+lon.toFixed(5), +lat.toFixed(5)])) },
    })
  }
  const out = {
    type: 'FeatureCollection',
    source: 'USGS Mars Global Digital Dune Database (MGD3), OFR 2007-1158, Dune_Field — https://pubs.usgs.gov/of/2007/1158/',
    features,
  }
  writeFileSync('public/data/gale-dunes.json', JSON.stringify(out))
  for (const { properties: p, geometry: g } of features)
    console.log(`${p.id}  ${p.areaKm2} km²  tipos ${p.type}  ${g.coordinates.length} anillo(s), ${g.coordinates.flat().length} puntos`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
