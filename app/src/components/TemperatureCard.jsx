import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
import { kToC } from '../lib/temperature'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

export default function TemperatureCard({ temp, ls, hour, setHour }) {
  if (!temp) return <p className="text-xs text-slate-500">Cargando temperatura…</p>
  const row = temp.table[ls]
  const now = row[hour]
  const hours = temp.lt
  const line = (key, color) => ({
    label: key === 'surf' ? 'Superficie' : 'Aire (2 m)',
    data: hours.map((h) => +kToC(row[h][key]).toFixed(1)),
    borderColor: color, pointRadius: hours.map((h) => (h === hour ? 5 : 0)), pointBackgroundColor: color, tension: 0.3,
  })
  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        <div className="flex items-baseline justify-between"><span className="text-slate-400">Hora local</span><b className="text-base text-cyan-300">{String(hour).padStart(2, '0')}:00</b></div>
        <input type="range" className="mt-1 w-full accent-cyan-400" min={0} max={22} step={2} value={hour} onChange={(e) => setHour(+e.target.value)} />
      </label>
      <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
        <div><div className="text-xs text-slate-400">Superficie</div><div className="text-lg text-cyan-300">{kToC(now.surf).toFixed(0)} °C</div></div>
        <div className="text-right"><div className="text-xs text-slate-400">Aire (2 m)</div><div className="text-lg text-cyan-300">{kToC(now.air).toFixed(0)} °C</div></div>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">Curva de 24 h</summary>
        <div className="mt-2 h-32">
          <Line
            data={{ labels: hours.map((h) => `${h}h`), datasets: [line('surf', '#f59e0b'), line('air', '#22d3ee')] }}
            options={{
              animation: false, maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 10, font: { size: 10 } } } },
              scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.05)' } } },
            }}
          />
        </div>
      </details>
    </div>
  )
}
