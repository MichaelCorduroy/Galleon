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

const HUB_RADIUS = 18;
const JITTER_RADIUS = 2.2;
const UNGENRED_RADIUS = 10;

// deterministic string hash (djb2) — used instead of Math.random() so the
// web's shape is stable across reloads: same library always looks the same
function hashString(value: string): number {
	let hash = 5381;
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 33) ^ value.charCodeAt(i);
	}
	return hash >>> 0;
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

export interface GenreWebLayout {
	hubs: GenreHub[];
	albums: PlacedAlbum[];
}

// builds the 3D layout from raw genre-web data: one hub per genre spread
// across a sphere, each album pulled toward the average of its own genres'
// hubs (so multi-genre albums naturally sit "between" clusters, forming the
// web), with a small stable jitter so same-genre albums don't overlap exactly
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

	return { hubs, albums: placed };
}
