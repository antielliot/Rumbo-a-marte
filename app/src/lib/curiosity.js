// Recorrido real de Curiosity (referencia). Solo se dibuja y se compara: nunca entra en el cálculo de A*.
const M_PER_DEG = (2 * Math.PI * 3396190) / 360;

export async function loadCuriosity() {
	const r = await fetch(
		`${import.meta.env.BASE_URL}data/curiosity-traverse.json`,
	);
	if (!r.ok)
		throw new Error(
			"Falta curiosity-traverse.json (corre: npm run fetch-curiosity)",
		);
	return r.json();
}

function projector(lat0) {
	const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
	return ([lon, lat]) => [lon * kx, lat * M_PER_DEG];
}

function distToPolyline(p, poly) {
	let best = Infinity;
	for (let i = 1; i < poly.length; i++) {
		const [ax, ay] = poly[i - 1],
			[bx, by] = poly[i];
		const dx = bx - ax,
			dy = by - ay,
			L2 = dx * dx + dy * dy;
		const t = L2
			? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
			: 0;
		const d = Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
		if (d < best) best = d;
	}
	return best;
}

/** Compara nuestra ruta (lista de [lon,lat]) con el recorrido de Curiosity.
 *  meanM / maxM: distancia de cada punto de nuestra ruta al recorrido de Curiosity; within = % a menos de `tolM`. */
export function compareRoutes(ours, curiosity, tolM = 500) {
	const P = projector(curiosity[0][1]);
	const poly = curiosity.map(P);
	let sum = 0,
		max = 0,
		inside = 0;
	for (const c of ours) {
		const d = distToPolyline(P(c), poly);
		sum += d;
		if (d > max) max = d;
		if (d <= tolM) inside++;
	}
	return {
		meanM: sum / ours.length,
		maxM: max,
		within: (100 * inside) / ours.length,
		tolM,
	};
}

const LANDING_MS = Date.UTC(2012, 7, 6, 5, 17); // aterrizaje de Curiosity (sol 0)
/** Fecha terrestre aproximada de un sol (1 sol = 1.02749125 días). */
export function solDate(sol) {
	return new Date(LANDING_MS + sol * 1.02749125 * 86400000);
}

/** Recorta el recorrido hasta el final del sol dado usando la distancia oficial acumulada (dist_km de NASA).
 *  Como la línea está simplificada, su largo se reescala al oficial para cortar en el punto correcto. */
export function cutAtSol(data, sol) {
	const { coords, sols } = data;
	let row = sols[sols.length - 1];
	for (const r of sols) {
		if (r[0] > sol) break;
		row = r;
	}
	const target = row[1];
	const P = projector(coords[0][1]);
	const cum = [0];
	for (let i = 1; i < coords.length; i++) {
		const a = P(coords[i - 1]),
			b = P(coords[i]);
		cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]) / 1000);
	}
	const goal = (target / data.distKm) * cum[cum.length - 1];
	const out = [coords[0]];
	for (let i = 1; i < coords.length; i++) {
		if (cum[i] <= goal) {
			out.push(coords[i]);
			continue;
		}
		const t = (goal - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
		const [a, b] = [coords[i - 1], coords[i]];
		out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
		break;
	}
	// el último punto es la posición oficial de Curiosity al final de ese sol (waypoint de NASA)
	if (row.length >= 4) out[out.length - 1] = [row[2], row[3]];
	return { coords: out, km: target };
}
