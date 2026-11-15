// Constantes FIJAS del modelo (no se exponen como controles). Cada una declara su origen:
//   'fuente'   = valor tomado de una publicación/estándar (con enlace)
//   'modelo'   = parte de un modelo físico/empírico publicado
//   'supuesto' = decisión nuestra, no verificada: se marca así en el panel de datos
export const CONST = {
  MAX_SLOPE_DEG: 20, // pendiente máxima caminable
  WALK_KMH: 2.7, // velocidad de marcha para caminatas largas
  MAX_EXCURSION_KM: 10, // alejamiento máximo de la base (planificación)
  DOSE_LIMIT_MSV: 600, // límite de dosis efectiva de carrera
  SUIT_EXT_K: [93, 378], // rango térmico externo de diseño del traje xEMU
  BASE: { name: 'Bradbury Landing (aterrizaje de Curiosity)', lat: -4.5895, lon: 137.4417 },
  ANTENNA_H_M: 2, // altura de antena (base y astronauta)
  MARS_OBLIQUITY_DEG: 25.19,
  CELL_M: 200, // DEM del cráter completo; la zona de Curiosity también existe a 50 m (DEM de 1 m promediado)
}

export const FIXED = [
  { id: 'slope', label: 'Pendiente máxima caminable', value: `${CONST.MAX_SLOPE_DEG}°`, kind: 'fuente',
    source: 'NASA, concepto de operaciones EVA lunar (Artemis, traje xEMU): caminar en pendientes de hasta 20° (Apollo 15 llegó a ~17°).',
    url: 'https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf',
    caveat: 'Valor lunar (1/6 g). No hay un límite publicado propio de Marte (0.38 g).' },
  { id: 'speed', label: 'Velocidad de marcha', value: `${CONST.WALK_KMH} km/h`, kind: 'fuente',
    source: 'Cifra de planificación de la NASA para caminatas de vuelta de más de 1 h, basada en Apollo (Apollo 14 promedió ~1.7 km/h hacia afuera).',
    url: 'https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.gaits.html',
    caveat: 'Basada en experiencia lunar. No hay dato de una misión en Marte.' },
  { id: 'excursion', label: 'Alejamiento máximo de la base', value: `${CONST.MAX_EXCURSION_KM} km`, kind: 'fuente',
    source: 'Supuesto de planificación de la NASA basado en la experiencia Apollo (se está probando en pruebas de "walkback").',
    url: 'https://ntrs.nasa.gov/api/citations/20210000827/downloads/Exporation%20EVA%20Testing%20and%20Analogs%2020210000827.pdf',
    caveat: 'Es una advertencia, no un bloqueo.' },
  { id: 'dose', label: 'Límite de dosis de carrera', value: `${CONST.DOSE_LIMIT_MSV} mSv`, kind: 'fuente',
    source: 'NASA-STD-3001: dosis efectiva total de carrera menor a 600 mSv, igual para todos los astronautas.',
    url: 'https://www.nationalacademies.org/news/nasa-should-update-astronaut-radiation-exposure-limits-improve-communication-of-cancer-risks',
    caveat: 'Para misiones a Marte se ha propuesto una excepción de hasta ~900 mSv.' },
  { id: 'suit', label: 'Rango térmico externo del traje', value: `${CONST.SUIT_EXT_K[0]} – ${CONST.SUIT_EXT_K[1]} K`, kind: 'fuente',
    source: 'Requisito de diseño del traje xEMU (ambiente lunar: 93 K polo sur frío a 378 K cráter caliente).',
    url: 'https://ntrs.nasa.gov/citations/20240005277',
    caveat: 'Es lunar. No encontramos límites térmicos publicados para un traje de Marte.' },
  { id: 'base', label: 'Base (punto de partida y de comunicación)', value: `${CONST.BASE.lat}°, ${CONST.BASE.lon}°`, kind: 'fuente',
    source: 'Sitio de aterrizaje de Curiosity (Bradbury Landing).', url: null, caveat: 'Coordenadas tomadas de la bibliografía común; la base es hipotética.' },
  { id: 'obliq', label: 'Oblicuidad de Marte', value: `${CONST.MARS_OBLIQUITY_DEG}°`, kind: 'fuente',
    source: 'Valor astronómico estándar; se usa para calcular la posición del Sol.', url: null, caveat: '' },
  { id: 'antenna', label: 'Altura de antena (base y astronauta)', value: `${CONST.ANTENNA_H_M} m`, kind: 'supuesto',
    source: 'Decisión nuestra.', url: null, caveat: 'No verificado contra ningún equipo real.' },
  { id: 'cell', label: 'Tamaño de celda del mapa', value: `${CONST.CELL_M} m`, kind: 'supuesto',
    source: 'Resolución del DEM global HRSC+MOLA (USGS) usado para cubrir todo el cráter Gale.', url: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m', caveat: 'La pendiente (y la rugosidad) se suavizan a esta escala: se subestiman pendientes abruptas.' },
]
