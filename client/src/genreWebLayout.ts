import type { GenreWebAlbum } from "./api";

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

export interface GenreHub {
	genre: string;
	position: Vec3;
}

export interface PlacedAlbum extends GenreWebAlbum {
	position: Vec3;
	hubPositions: Vec3[];
}

export const ORB_RADIUS = 1.1;

const HUB_RADIUS = 38;
const JITTER_RADIUS = 7;
const UNGENRED_RADIUS = 22;

// clear surface-to-surface gap once relaxed, not just center-to-center —
// tuned well above 2x ORB_RADIUS so covers never visually touch
const MIN_SEPARATION = ORB_RADIUS * 3.2;
const RELAXATION_ITERATIONS = 30;

// deterministic string hash (djb2) — used instead of Math.random() so the
// web's shape is stable across reloads: same library always looks the same
function hashString(value: string): number {
	let hash = 5381;
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 33) ^ value.charCodeAt(i);
	}
	return hash >>> 0;
}

// a stable, evenly-spread hue per genre name — the component turns this into
// an actual color for both filter chips and region auras, so the two always
// agree with each other and stay consistent across reloads
export function genreHue(genre: string): number {
	return hashString(genre) % 360;
}

// evenly distributes N points across a sphere's surface — gives genre hubs
// a natural, non-clumped spread instead of random placement
function fibonacciSpherePoint(index: number, total: number, radius: number): Vec3 {
	if (total <= 1) return { x: 0, y: 0, z: radius };
	const offset = 2 / total;
	const increment = Math.PI * (3 - Math.sqrt(5)); // golden angle

	const y = index * offset - 1 + offset / 2;
	const r = Math.sqrt(Math.max(0, 1 - y * y));
	const phi = index * increment;

	return {
		x: Math.cos(phi) * r * radius,
		y: y * radius,
		z: Math.sin(phi) * r * radius,
	};
}

function addScaled(a: Vec3, b: Vec3, scale: number): Vec3 {
	return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

// deterministic pseudo-random unit-ish offset derived from a string seed,
// so the same album always jitters the same way
function seededJitter(seed: string, magnitude: number): Vec3 {
	const h1 = hashString(seed);
	const h2 = hashString(seed + "y");
	const h3 = hashString(seed + "z");
	const toSigned = (h: number) => ((h % 2000) / 1000 - 1) * magnitude;
	return { x: toSigned(h1), y: toSigned(h2), z: toSigned(h3) };
}

// pushes any albums closer than MIN_SEPARATION apart, using a spatial hash
// grid so it stays roughly linear in the number of albums instead of the
// naive O(n^2) all-pairs check — matters once a library has hundreds of
// albums clustered into the same handful of genres
function relaxPositions(albums: PlacedAlbum[]): void {
	if (albums.length < 2) return;
	const cellSize = MIN_SEPARATION;
	const cellKey = (p: Vec3) => `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)},${Math.floor(p.z / cellSize)}`;

	for (let iter = 0; iter < RELAXATION_ITERATIONS; iter++) {
		const grid = new Map<string, number[]>();
		albums.forEach((a, i) => {
			const key = cellKey(a.position);
			const bucket = grid.get(key);
			if (bucket) bucket.push(i);
			else grid.set(key, [i]);
		});

		const dx = new Float64Array(albums.length);
		const dy = new Float64Array(albums.length);
		const dz = new Float64Array(albums.length);
		let moved = false;

		for (const [key, homeIndices] of grid) {
			const [cx, cy, cz] = key.split(",").map(Number);
			const candidates: number[] = [];
			for (let ox = -1; ox <= 1; ox++) {
				for (let oy = -1; oy <= 1; oy++) {
					for (let oz = -1; oz <= 1; oz++) {
						const neighbor = grid.get(`${cx + ox},${cy + oy},${cz + oz}`);
						if (neighbor) candidates.push(...neighbor);
					}
				}
			}

			for (const i of homeIndices) {
				for (const j of candidates) {
					if (j <= i) continue;
					const a = albums[i].position;
					const b = albums[j].position;
					const ddx = b.x - a.x;
					const ddy = b.y - a.y;
					const ddz = b.z - a.z;
					const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
					const dist = Math.sqrt(distSq);

					if (dist > 0.0001 && dist < MIN_SEPARATION) {
						const push = (MIN_SEPARATION - dist) / 2;
						const nx = ddx / dist;
						const ny = ddy / dist;
						const nz = ddz / dist;
						dx[i] -= nx * push;
						dy[i] -= ny * push;
						dz[i] -= nz * push;
						dx[j] += nx * push;
						dy[j] += ny * push;
						dz[j] += nz * push;
						moved = true;
					} else if (dist <= 0.0001) {
						// exact overlap (identical average position) — nudge apart with
						// a deterministic pseudo-direction derived from the pair's indices
						const nx = (((i * 37 + j * 13) % 7) - 3) || 1;
						const ny = (((i * 17 + j * 29) % 7) - 3) || 1;
						const nz = (((i * 11 + j * 19) % 7) - 3) || 1;
						const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
						const push = MIN_SEPARATION / 2;
						dx[i] -= (nx / len) * push;
						dy[i] -= (ny / len) * push;
						dz[i] -= (nz / len) * push;
						dx[j] += (nx / len) * push;
						dy[j] += (ny / len) * push;
						dz[j] += (nz / len) * push;
						moved = true;
					}
				}
			}
		}

		if (!moved) break;
		albums.forEach((a, i) => {
			a.position.x += dx[i];
			a.position.y += dy[i];
			a.position.z += dz[i];
		});
	}
}

export interface GenreWebLayout {
	hubs: GenreHub[];
	albums: PlacedAlbum[];
}

// builds the 3D layout from raw genre-web data: one hub per genre spread
// across a sphere, each album pulled toward the average of its own genres'
// hubs (so multi-genre albums naturally sit "between" clusters, forming the
// web), then relaxed apart so densely-shared genres don't render as a
// clumped mess of overlapping covers
export function buildGenreWebLayout(genres: string[], albums: GenreWebAlbum[]): GenreWebLayout {
	const hubs: GenreHub[] = genres.map((genre, i) => ({
		genre,
		position: fibonacciSpherePoint(i, genres.length, HUB_RADIUS),
	}));
	const hubPositionByGenre = new Map(hubs.map((h) => [h.genre, h.position]));

	const placed: PlacedAlbum[] = albums.map((album) => {
		const key = `${album.artist}::${album.album}`;
		const matchedHubs = album.genres.map((g) => hubPositionByGenre.get(g)).filter((p): p is Vec3 => Boolean(p));

		let base: Vec3;
		if (matchedHubs.length === 0) {
			// no genre data — scatter near the center instead of hiding it
			base = addScaled({ x: 0, y: 0, z: 0 }, seededJitter(key, 1), UNGENRED_RADIUS);
		} else {
			const sum = matchedHubs.reduce((acc, p) => addScaled(acc, p, 1), { x: 0, y: 0, z: 0 });
			base = { x: sum.x / matchedHubs.length, y: sum.y / matchedHubs.length, z: sum.z / matchedHubs.length };
		}

		const jitter = seededJitter(key, JITTER_RADIUS);
		return {
			...album,
			position: addScaled(base, jitter, 1),
			hubPositions: matchedHubs,
		};
	});

	relaxPositions(placed);

	return { hubs, albums: placed };
}
