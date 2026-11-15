import { FIXED, CONST } from '../lib/constants'
import { SOLAR } from '../lib/radiation'
import { SEASONS } from '../lib/temperature'

const KIND = {
  real: ['DATO REAL', 'bg-green-900/60 text-green-300'],
  modelo: ['MODELO', 'bg-amber-900/60 text-amber-300'],
  fuente: ['CONSTANTE (con fuente)', 'bg-cyan-900/60 text-cyan-300'],
  supuesto: ['SUPUESTO NUESTRO', 'bg-red-900/60 text-red-300'],
  info: ['SOLO INFORMATIVO', 'bg-slate-700 text-slate-300'],
}
const Tag = ({ k }) => <span className={`ml-2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${KIND[k][1]}`}>{KIND[k][0]}</span>
const H = ({ children }) => <h3 className="mb-2 mt-6 border-b border-cyan-900/60 pb-1 text-sm font-bold uppercase tracking-widest text-cyan-300">{children}</h3>
const Row = ({ title, kind, children }) => (
  <li className="mb-2.5 text-sm leading-snug">
    <b className="text-slate-100">{title}</b><Tag k={kind} />
    <div className="text-slate-400">{children}</div>
  </li>
)

export default function DataPanel({ onClose, state }) {
  const { w, maxElev, solar, ls, hour, temp, stats } = state
  const row = temp?.table[ls]?.[hour]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div className="relative my-6 w-full max-w-3xl rounded-lg border border-cyan-900 bg-[#070c16] p-6 text-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="absolute right-4 top-4 rounded border border-cyan-800 px-3 py-1 text-xs hover:bg-cyan-900/40" onClick={onClose}>Cerrar ✕</button>
        <h2 className="text-lg font-bold text-cyan-300">Datos que se toman en cuenta para la ruta</h2>
        <p className="mt-1 text-xs text-slate-400">
          Costo de cada paso = distancia × (1 + preferencias de la celda + esfuerzo del gradiente). A* busca el camino de menor costo total.
          Cada dato indica si es medición, modelo o supuesto.
        </p>

        <H>1 · Parámetros que tú controlas</H>
        <ul>
          <Row title="Estación (Ls)" kind="real">{SEASONS[ls]}. Cambia la presión (radiación), la temperatura y la posición del Sol.</Row>
          <Row title="Hora local" kind="real">{String(hour).padStart(2, '0')}:00. Cambia presión, temperatura y sombras.</Row>
          <Row title="Actividad solar" kind="modelo">{SOLAR[solar].label}. Cambia cuánto protege la atmósfera de la radiación.</Row>
          <Row title="Altura máxima" kind="info">{maxElev} m. Filtro de misión: bloquea todo lo más alto. No es un límite físico; la altura ya pesa vía la radiación.</Row>
          <Row title="Prioridades" kind="info">
            Fijas (ya no se editan): esfuerzo {w.effort} · radiación {w.rad} · rugosidad {w.rough} · comunicación {w.comm} · dunas {w.sand}.
            Cada factor está normalizado de 0 (ideal) a 1 (lo peor). Costo de cada metro = 1 + Σ peso × riesgo: con peso 1, lo peor de un factor hace que ese metro cueste el doble. Los pesos son una <b>decisión nuestra</b>, no una magnitud física.
          </Row>
          <Row title="Inicio y destino" kind="info">Los dos puntos que marcas con clic en el mapa.</Row>
        </ul>

        <H>2 · Constantes fijas (no se pueden cambiar)</H>
        <ul>
          {FIXED.map((c) => (
            <Row key={c.id} title={`${c.label}: ${c.value}`} kind={c.kind}>
              {c.source} {c.url && <a className="text-cyan-400 underline" href={c.url} target="_blank" rel="noreferrer">fuente</a>}
              {c.caveat && <div className="text-amber-300/80">Ojo: {c.caveat}</div>}
            </Row>
          ))}
        </ul>

        <H>3 · Datos reales (mediciones)</H>
        <ul>
          <Row title="Elevación, pendiente y gradiente" kind="real">
            DEM global de USGS "MOLA–HRSC Blended DEM 200 m" v2, ventana de todo el cráter Gale, celdas de {CONST.CELL_M} m. Rango: {Math.round(state.elevMin)} a {Math.round(state.elevMax)} m.
            La pendiente es regional (a {CONST.CELL_M} m), no la de la escala de un pie o una rueda.
          </Row>
          <Row title="Rugosidad" kind="real">
            Desviación de la altura respecto a un plano en ventanas de 3×3 celdas (~600 m) del mismo DEM. Es un indicador de relieve irregular, no de rocas: a {CONST.CELL_M} m no se resuelven rocas ni escalones pequeños.
            Se convierte a riesgo 0–1 de forma <b>relativa a la zona</b> (percentil 95 = 1); no hay un umbral físico publicado.
          </Row>
          <Row title="Campos de dunas" kind="real">
            Base de datos global de dunas de Marte del USGS (MGD3, Hayward et al. 2007, <a className="text-cyan-400 underline" href="https://pubs.usgs.gov/of/2007/1158/" target="_blank" rel="noreferrer">OFR 2007-1158</a>): 2 campos en Gale (1370-050 con las dunas Bagnold, 425 km²; 1376-059, 414 km²), mapeados con imágenes THEMIS y MOC.
            Cada celda guarda qué fracción cae dentro de un campo. Es el <b>contorno del campo</b>: dentro hay arena y también roca entre dunas. Encarece cruzar, no bloquea (Curiosity cruzó las dunas).
          </Row>
          <Row title="Presión y temperatura de superficie" kind="modelo">
            Mars Climate Database v6 (LMD), escenario de polvo promedio, centro de la zona. Ahora: superficie {row ? (row.surf - 273.15).toFixed(0) : '–'} °C, aire {row ? (row.air - 273.15).toFixed(0) : '–'} °C, presión {row ? row.pres.toFixed(0) : '–'} Pa.
            Es un modelo climático, no una medición.
          </Row>
        </ul>

        <H>4 · Modelos y cálculos</H>
        <ul>
          <Row title="Radiación (dosis equivalente)" kind="modelo">
            Anclado en la medición de MSL/RAD (~0.67 mSv/día) y la pendiente dosis–presión de HZETRN2015 (Guo et al. 2018). La presión sigue la estación y la hora (MCD) y la altura (atmósfera isoterma a 210 K, <b>supuesto nuestro</b>).
            Fuera de 700–950 Pa es una extrapolación lineal. Sin relieve local ni albedo. Riesgo en escala fija: 0.60 → 0, 0.90 mSv/día → 1.
          </Row>
          <Row title="Esfuerzo al subir y bajar" kind="modelo">
            Polinomio de Minetti et al. (2002) del costo metabólico al caminar según el gradiente. Coeficientes coherentes con valores publicados, pero no verificados contra el texto del artículo.
            Medido en la Tierra (1 g) y sin traje: en Marte (0.38 g) cambia.
            En la ruta se normaliza de 0 a 1: 0 = bajada suave (lo más fácil), 1 = subir a {CONST.MAX_SLOPE_DEG}° (el límite). Caminar en plano ≈ 0.12.
          </Row>
          <Row title="Capa de sombras (solo visual)" kind="modelo">
            Posición del Sol (oblicuidad de Marte, latitud, estación y hora) y sombras del terreno desde el DEM. No influye en la ruta.
          </Row>
          <Row title="Comunicación" kind="modelo">
            Línea de vista desde la base con antenas a {CONST.ANTENNA_H_M} m sobre el DEM. Aproximada: el DEM de {CONST.CELL_M} m no resuelve lomas pequeñas. Incluye la curvatura de Marte. No modela alcance de la radio.
          </Row>
          <Row title="Esquinas" kind="info">Un paso diagonal no puede pasar entre dos celdas bloqueadas.</Row>
          <Row title="Tiempo y dosis de la salida" kind="modelo">
            Tiempo = distancia / {CONST.WALK_KMH} km/h. Dosis = suma de la dosis de cada celda por el tiempo en ella, <b>sin blindaje del traje</b>. Se compara con el límite de carrera de {CONST.DOSE_LIMIT_MSV} mSv.
          </Row>
          <Row title="Temperatura" kind="info">
            Solo se muestra y se compara con el rango del traje durante el tiempo de la salida. <b>No cambia la ruta</b>: en la MCD casi no varía dentro de la zona (~1 K en 150 km); varía con la hora y la estación.
          </Row>
        </ul>

        {stats && (
          <>
            <H>5 · Resultado de la ruta actual</H>
            <p className="text-sm text-slate-300">
              {stats.km.toFixed(1)} km · {stats.timeH.toFixed(1)} h a pie · dosis {stats.doseMsv.toFixed(3)} mSv ({((100 * stats.doseMsv) / CONST.DOSE_LIMIT_MSV).toFixed(2)}% del límite de carrera)
              · esfuerzo {stats.effortRel.toFixed(2)}× el de terreno plano · {stats.visPct.toFixed(0)}% con comunicación · alejamiento máx. {stats.maxExcKm.toFixed(1)} km de la base.
            </p>
          </>
        )}

        <H>6 · Lo que NO se considera</H>
        <ul className="list-disc pl-5 text-sm text-slate-400">
          <li>Arena suelta fuera de los campos de dunas del USGS (parches pequeños, suelo blando) y la forma de cada duna dentro del campo.</li>
          <li>Rocas individuales y pendiente a escala de metros.</li>
          <li>Consumo de oxígeno, energía o autonomía del traje; la gravedad de Marte en el esfuerzo.</li>
          <li>Tormentas de polvo, cambios del escenario de polvo, y variación de la temperatura dentro de la zona.</li>
          <li>Ruta de regreso, duración total de la misión y tareas científicas.</li>
          <li>Límites térmicos de un traje de Marte (no encontramos valores publicados).</li>
        </ul>
      </div>
    </div>
  )
}
