// Traje en las condiciones actuales de la caminata. Origen: SuitPanel.tsx + suit.ts de Rumbo Marte.
// Compara un traje tipo lunar (AxEMU, depende del vacío) contra un concepto de traje marciano.
import { useMemo, useState } from 'react'
import { evaluarTraje, latencia, TRAJE_LUNAR, TRAJE_MARCIANO, BIOMETRIA_EJEMPLO } from '../../lib/suit'
import { EVA } from '../../lib/eva'

const WORD = { verde: 'VERDE', ambar: 'ÁMBAR', rojo: 'ROJO' }
const DOT = { verde: 'bg-emerald-400', ambar: 'bg-amber-400', rojo: 'bg-red-400' }

export default function SuitPanel({ t }) {
  const [tipo, setTipo] = useState('marciano')
  const [ua, setUa] = useState(1.5)
  const ev = useMemo(() => {
    if (!t) return null
    const ambiente = {
      cuerpo: 'marte', presionPa: Math.round(t.presPa ?? 750), tempSueloC: Math.round(t.surfC ?? -40),
      tasaDosis_mSvDia: +t.rad0.toFixed(2), tormentaSolar: t.flare && !t.inShelter, opacidadPolvo: t.tau,
      percloratoPct: EVA.PERCHLORATE_PCT, pendienteGrados: Math.round(t.slope),
    }
    const traje = { ...(tipo === 'lunar' ? TRAJE_LUNAR : TRAJE_MARCIANO), o2RestanteHoras: +t.o2LeftH.toFixed(1), bateriaRestante_Wh: Math.round(t.battLeftWh) }
    const regreso = {
      o2CostoRegresoHoras: +t.margin.backH.toFixed(2), bateriaCostoRegreso_Wh: Math.round(t.margin.backH * EVA.SUIT_POWER_W),
      minutosAlRefugio: t.inShelter ? 0 : Math.round((t.shelter.distKm / t.speedKmh) * 60), minutosAvisoTormenta: EVA.STORM_WARNING_MIN,
    }
    return evaluarTraje(ambiente, traje, { ...BIOMETRIA_EJEMPLO, dosisEva_mSv: +t.doseMSv.toFixed(3) }, regreso)
  }, [t, tipo])
  const lat = useMemo(() => latencia('marte', ua), [ua])

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Traje en estas condiciones</h2>
        <div className="flex overflow-hidden rounded-md border border-white/15 text-xs" role="group" aria-label="Tipo de traje">
          {[['marciano', 'Marciano'], ['lunar', 'Lunar (AxEMU)']].map(([k, label]) => (
            <button key={k} aria-pressed={tipo === k} onClick={() => setTipo(k)} className={`px-2 py-1 ${tipo === k ? 'bg-amber-400/15 text-amber-200' : 'text-slate-300 hover:bg-white/10'}`}>{label}</button>
          ))}
        </div>
      </div>
      {!ev ? <p className="text-sm text-slate-400">Se evalúa sobre la ruta: marca inicio y destino.</p> : (
        <>
          <p className={`text-sm ${ev.estado === 'rojo' ? 'text-red-300' : ev.estado === 'ambar' ? 'text-amber-300' : 'text-emerald-300'}`}>
            <b>{WORD[ev.estado]}</b>{ev.estado !== 'verde' && <span className="text-slate-400"> · peor: {ev.peor.parametro.toLowerCase()}. {ev.peor.razon}</span>}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {ev.chequeos.map((c) => (
              <li key={c.parametro} className="grid grid-cols-[10px_1fr_auto] items-baseline gap-2 border-t border-white/5 pt-1" title={c.razon}>
                <i className={`h-2 w-2 self-center rounded-full ${DOT[c.estado]}`} />
                <span className={c.estado === 'rojo' ? 'text-red-300' : c.estado === 'ambar' ? 'text-amber-300' : 'text-slate-300'}>{c.parametro}<span className="block text-slate-500">{c.limite}</span></span>
                <span className="text-right text-slate-200">{c.valor}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="mt-3 block text-xs text-slate-400">
        Distancia Tierra–Marte {ua.toFixed(2)} UA → {(lat.idaSegundos / 60).toFixed(1)} min de retraso por trayecto
        <input type="range" className="mt-1 w-full accent-cyan-400" min={0.37} max={2.67} step={0.01} value={ua} onChange={(e) => setUa(+e.target.value)} />
      </label>
      <p className="text-[11px] text-slate-500">Modo {lat.modo}: {lat.explicacion} Por eso las alertas del reloj y del HUD se calculan en el traje.</p>
      <p className="mt-2 text-[11px] text-slate-500"><b className="text-amber-300/80">Umbrales de demostración</b> (ajustar con NASA-STD-3001). Biometría, desgaste y perclorato ({EVA.PERCHLORATE_PCT}%) son valores de ejemplo; presión, temperatura, radiación, pendiente, O₂ y regreso salen de la caminata.</p>
    </section>
  )
}
