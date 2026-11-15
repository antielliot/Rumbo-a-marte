import { Line } from 'react-chartjs-2'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

export default function ElevationProfile({ dem, route }) {
  if (!route) return <p className="text-xs text-slate-500">Sin ruta todavía.</p>
  const cellKm = dem.cellM / 1000
  let acc = 0
  const labels = route.cells.map((c, i) => {
    if (i) acc += Math.hypot(c[0] - route.cells[i - 1][0], c[1] - route.cells[i - 1][1]) * cellKm
    return acc.toFixed(1)
  })
  const data = route.cells.map(([x, y]) => dem.elev[y * dem.w + x])
  return (
    <Line
      data={{ labels, datasets: [{ data, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,.18)', fill: true, pointRadius: 0, tension: 0.2 }] }}
      options={{
        animation: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, title: { display: true, text: 'km', color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8' }, title: { display: true, text: 'm', color: '#94a3b8' } },
        },
      }}
    />
  )
}
