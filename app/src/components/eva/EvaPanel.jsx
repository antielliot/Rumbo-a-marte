// Panel de EVA: control de la caminata simulada, estado de seguridad, clima espacial (manual y DONKI),
// veredicto del evaluador de rutas y bitácora de dosis por sol. Origen: SafetyPanel.tsx de Rumbo Marte.
import { useMemo, useState } from 'react'
import { STATUS, fmtClock } from './shared'
import { cardinal, EVA, solEntries } from '../../lib/eva'
import { checkSolarAlert } from '../../lib/donki'
import { summarizeLog } from '../../lib/radiationLog'
import { STATUS_LABEL } from '../../lib/routeEvaluator'
import { CONST } from '../../lib/constants'
import { ACCELS } from '../../lib/useEva'

const Title = ({ children }) => <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{children}</h2>
const Btn = ({ on, danger, className = '', ...p }) => (
  <button {...p} className={`rounded-md border px-2.5 py-1 text-xs disabled:opacity-40 ${on ? (danger ? 'border-red-400/60 bg-red-500/15 text-red-200' : 'border-amber-400/60 bg-amber-400/15 text-amber-200') : 'border-white/15 text-slate-300 hover:bg-white/10'} ${className}`} />
)
const BOX = {
  verde: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
  ambar: 'border-amber-400/50 bg-amber-400/10 text-amber-200',
  rojo: 'border-red-500/60 bg-red-500/15 text-red-200 animate-pulse',
}
const MODE = { idle: 'Sin salir', running: 'Caminando', paused: 'En pausa', arrived: 'En el destino', returned: 'De vuelta en la salida' }
const COND = { 'gcr-normal': 'normal', 'evento-solar': 'evento solar', 'tormenta-de-polvo': 'polvo' }

export default function EvaPanel({ t, st, eva, flare, setFlare, dustTau, setDustTau, verdict, onHud }) {
  const { controls, accel } = eva
  const [donki, setDonki] = useState(null)
  const [checking, setChecking] = useState(false)
  const solHour = Math.floor(st.solAcc.hours)
  const log = useMemo(() => summarizeLog(solEntries(st)), [st.sol, st.log, solHour]) // eslint-disable-line react-hooks/exhaustive-deps
  const mode = st.mode

  const ask = async () => { setChecking(true); setDonki(await checkSolarAlert()); setChecking(false) }

  return (
    <>
      <section>
        <Title>Caminata (EVA)</Title>
        {!t ? (
          <p className="text-sm text-slate-400">Marca inicio y destino en el mapa para planear una caminata. <span className="text-slate-500">Consejo: sal desde la base para que el refugio sea el hábitat.</span></p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Btn on={mode === 'running'} onClick={controls.toggle}>{{ idle: '▶ Iniciar', running: '❚❚ Pausar', paused: '▶ Reanudar', arrived: '↩ Volver', returned: '▶ Salir otra vez' }[mode]}</Btn>
              <Btn disabled={mode === 'idle' || t.s <= 0} onClick={controls.goShelter}>Ir al refugio</Btn>
              <Btn disabled={mode === 'idle'} onClick={controls.end}>Terminar</Btn>
              <Btn onClick={onHud}>Visor HUD (H)</Btn>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Tiempo simulado</span>
              {ACCELS.map((a) => <Btn key={a} on={accel === a} onClick={() => controls.setAccel(a)}>×{a}</Btn>)}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {MODE[mode]} · {(t.s / 1000).toFixed(1)} de {(t.length / 1000).toFixed(1)} km · {t.hours.toFixed(1)} h de EVA · sol {t.sol}, {fmtClock(t.clock)} · {t.speedKmh.toFixed(1)} km/h
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-cyan-400" style={{ width: `${(100 * t.s) / Math.max(1, t.length)}%` }} /></div>
          </>
        )}
      </section>

      {t && (
        <section>
          <Title>Seguridad</Title>
          <div className={`flex items-baseline gap-3 rounded-md border px-3 py-2 ${BOX[t.status]}`} role="status" aria-live="polite">
            <b className="text-lg tracking-wider">{STATUS[t.status].word}</b><span className="text-sm">{STATUS[t.status].line}</span>
          </div>
          {t.reasons.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs">
              {t.reasons.map((r) => <li key={r.text} className={r.level === 'rojo' ? 'text-red-300' : 'text-amber-300'}>• {r.text}</li>)}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-400">Sin avisos: radiación, polvo, consumibles y enlace dentro de rango.</p>}

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {[
              ['Radiación ahora', `${t.doseRate.toFixed(2)} mSv/día${t.inShelter ? ' (a cubierto)' : ''}`, t.doseRate >= 3 ? 'text-red-300' : t.doseRate >= 1.5 ? 'text-amber-300' : ''],
              ['Dosis de la EVA', `${t.doseMSv.toFixed(3)} mSv · ${((100 * t.doseMSv) / CONST.DOSE_LIMIT_MSV).toFixed(3)}% del límite`, ''],
              ['Temperatura (MCD)', t.surfC === null ? '–' : `${t.surfC.toFixed(0)} °C suelo · ${t.airC.toFixed(0)} °C aire`, ''],
              ['Presión', t.presPa === null ? '–' : `${Math.round(t.presPa)} Pa`, ''],
              ['Polvo (τ)', t.tau.toFixed(1), t.tau >= 3 ? 'text-red-300' : ''],
              ['Sol sobre el horizonte', `${t.sunElev.toFixed(0)}°${t.sunElev < 0 ? ' (noche)' : ''}`, ''],
              ['Enlace con la base', t.comm ? 'Con línea de vista' : 'Sin línea de vista', t.comm ? '' : 'text-amber-300'],
              ['Pendiente aquí', `${t.slope.toFixed(0)}°`, t.slope > 15 ? 'text-amber-300' : ''],
            ].map(([k, v, c]) => <div key={k} className="border-t border-white/10 pt-1"><dt className="text-slate-500">{k}</dt><dd className={`text-slate-200 ${c}`}>{v}</dd></div>)}
          </dl>

          <div className="mt-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Margen de regreso (O₂)</span>
              <b className={t.margin.level === 'rojo' ? 'text-red-300' : t.margin.level === 'ambar' ? 'text-amber-300' : 'text-emerald-300'}>{t.margin.atStart ? 'en la salida' : `${Math.min(99, t.margin.ratio).toFixed(2)}×`}</b></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10"><div className={`h-full ${t.margin.level === 'rojo' ? 'bg-red-400' : t.margin.level === 'ambar' ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${t.margin.atStart ? 100 : Math.min(100, (Math.min(t.margin.ratio, 3) / 3) * 100)}%` }} /></div>
            <p className="mt-1 text-slate-500">O₂ restante {t.o2LeftH.toFixed(1)} h ÷ {t.margin.backH.toFixed(1)} h para volver por el camino recorrido. Verde desde 1.5×, ámbar desde 1.3×, rojo debajo (punto de no retorno). Batería {Math.round(t.battPct)}%.</p>
          </div>
          <p className="mt-2 text-xs text-slate-400">Refugio: <b className="text-slate-200">{t.shelter.name}</b>{t.inShelter ? ' (estás a cubierto: la dosis baja al 15%)' : `, ${t.shelter.distKm.toFixed(1)} km al ${cardinal(t.shelter.bearing)} por el camino recorrido`}.</p>
        </section>
      )}

      <section>
        <Title>Clima espacial y polvo</Title>
        <div className="flex flex-wrap gap-1.5">
          <Btn on={flare} danger onClick={() => setFlare(!flare)}>Tormenta solar {flare ? 'activa' : 'apagada'}</Btn>
          <Btn on={dustTau !== null} onClick={() => setDustTau(dustTau === null ? EVA.STORM_TAU : null)}>Tormenta de polvo {dustTau !== null ? `τ ${dustTau}` : 'apagada'}</Btn>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Tormenta solar: la dosis del modelo × {EVA.SPE_FACTOR} fuera del refugio (supuesto). Polvo: τ {EVA.STORM_TAU} frena la marcha y pone la EVA en rojo. La hora y la estación se cambian en Escenario y Opciones.</p>
        <div className="mt-3 space-y-1.5">
          <Btn onClick={ask} disabled={checking}>{checking ? 'Consultando DONKI…' : 'Consultar alertas solares reales (NASA DONKI)'}</Btn>
          {donki && (donki.error
            ? <p className="text-xs text-slate-400">Sin respuesta de DONKI ({donki.error}). Usa el interruptor manual.</p>
            : donki.active
              ? <p className="text-xs text-amber-300">DONKI: {donki.recentSep.length} evento(s) de partículas solares y {donki.marsNotifications.length} aviso(s) que mencionan Marte en 3 días. {!flare && <button className="underline" onClick={() => setFlare(true)}>Activar alerta</button>}</p>
              : <p className="text-xs text-emerald-300">DONKI: sin eventos solares en los últimos 3 días.</p>)}
          <p className="text-[11px] text-slate-500">DONKI no dice si un evento llega a Marte: es una heurística, por eso el interruptor manual se queda.</p>
        </div>
      </section>

      {verdict && (
        <section>
          <Title>Evaluador de la ruta</Title>
          <p className="text-sm"><b className={verdict.ev.status === 'viable' ? 'text-emerald-300' : verdict.ev.status === 'regresar-por-aqui' ? 'text-amber-300' : 'text-red-300'}>{STATUS_LABEL[verdict.ev.status]}</b>
            <span className="text-slate-400"> · ida y vuelta {verdict.ev.route.distanceKm.toFixed(1)} km, {verdict.ev.hours.toFixed(1)} h, {verdict.ev.doseMSv.toFixed(3)} mSv</span></p>
          <p className="mt-1 text-xs text-slate-400">{verdict.reason}</p>
          <p className="mt-1 text-[11px] text-slate-500">Criterio del equipo: EVA de 8 h con 1 h de margen; con τ ≥ 4 solo rutas a menos de 1 km de un refugio; τ ≥ 6 no salir; pendiente máxima {CONST.MAX_SLOPE_DEG}°. Lejanía máxima a un refugio en esta ruta: {verdict.ev.route.maxDistanceToShelterKm.toFixed(1)} km.</p>
        </section>
      )}

      {log.length > 0 && st.solAcc.hours + st.log.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">Bitácora de dosis por sol</summary>
          <table className="mt-2 w-full text-xs">
            <thead className="text-slate-500"><tr><th className="text-left font-normal">Sol</th><th className="text-left font-normal">Condición</th><th className="text-right font-normal">mSv/día</th><th className="text-right font-normal">EVA h</th><th className="text-right font-normal">Acum.</th></tr></thead>
            <tbody>
              {log.slice(-6).map((e) => (
                <tr key={e.sol} className="border-t border-white/5"><td>{e.sol}{e.sol === st.sol ? '*' : ''}</td><td>{COND[e.condition] ?? e.condition}</td><td className="text-right">{e.equivalentMSvPerDay.toFixed(2)}</td><td className="text-right">{e.evaHours.toFixed(1)}</td><td className="text-right">{e.cumulativeMSv.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">* sol en curso. Cuenta el sol completo a la tasa promedio del tiempo simulado, contra el límite de carrera de {CONST.DOSE_LIMIT_MSV} mSv.</p>
        </details>
      )}
    </>
  )
}
