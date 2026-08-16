import db from "./database";

const BASE = "https://ws.audioscrobbler.com/2.0/";
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — similar-artist/tag data barely shifts

export interface SimilarArtist {
	name: string;
	match: number;
}

async function fetchSimilarFromLastfm(artist: string): Promise<SimilarArtist[]> {
	const apiKey = process.env.LASTFM_API_KEY;
	if (!apiKey) return [];

	const url = `${BASE}?method=artist.getsimilar&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=12`;
	const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`Last.fm request failed: ${res.status} ${res.statusText}`);

	const data = await res.json();
	if (data.error) return []; // e.g. artist not found on Last.fm — not a hard failure

	const artists = data.similarartists?.artist ?? [];
	return artists.map((a: any) => ({ name: a.name as string, match: parseFloat(a.match) || 0 }));
}

const cachedFor = db.prepare(
	`SELECT similar_artist as name, match, fetched_at FROM similar_artists WHERE artist = ? ORDER BY match DESC`,
);
const deleteFor = db.prepare(`DELETE FROM similar_artists WHERE artist = ?`);
const insertOne = db.prepare(
	`INSERT INTO similar_artists (artist, similar_artist, match, fetched_at) VALUES (?, ?, ?, ?)`,
);

export async function getSimilarArtists(artist: string): Promise<SimilarArtist[]> {
	const cached = cachedFor.all(artist) as { name: string; match: number; fetched_at: number }[];
	const newest = cached[0];
	if (newest && Date.now() - newest.fetched_at < CACHE_TTL_MS) {
		return cached.map((c) => ({ name: c.name, match: c.match }));
	}

	let fresh: SimilarArtist[];
	try {
		fresh = await fetchSimilarFromLastfm(artist);
	} catch {
		// serve stale cache rather than nothing if Last.fm hiccups
		return cached.map((c) => ({ name: c.name, match: c.match }));
	}

	deleteFor.run(artist);
	const now = Date.now();
	for (const s of fresh) {
		insertOne.run(artist, s.name, s.match, now);
	}

	return fresh;
}

const TOP_TAGS_LIMIT = 3;

async function fetchTopTagsFromLastfm(artist: string): Promise<string[]> {
	const apiKey = process.env.LASTFM_API_KEY;
	if (!apiKey) return [];

	const url = `${BASE}?method=artist.gettoptags&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json`;
	const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`Last.fm request failed: ${res.status} ${res.statusText}`);

	const data = await res.json();
	if (data.error) return [];

	const tags = data.toptags?.tag ?? [];
	return tags
		.slice(0, TOP_TAGS_LIMIT)
		.map((t: any) => (t.name as string).toLowerCase())
		.filter(Boolean);
}

const cachedGenres = db.prepare(`SELECT genres, fetched_at FROM artist_genres WHERE artist = ?`);
const upsertGenres = db.prepare(`
	INSERT INTO artist_genres (artist, genres, fetched_at) VALUES (?, ?, ?)
	ON CONFLICT(artist) DO UPDATE SET genres = excluded.genres, fetched_at = excluded.fetched_at
`);

// top Last.fm tags for an artist, treated as genres — same lazy 30-day cache
// pattern as getSimilarArtists, just a different Last.fm method
export async function getTopTags(artist: string): Promise<string[]> {
	const row = cachedGenres.get(artist) as { genres: string; fetched_at: number } | undefined;
	if (row && Date.now() - row.fetched_at < CACHE_TTL_MS) {
		return JSON.parse(row.genres);
	}

	let fresh: string[];
	try {
		fresh = await fetchTopTagsFromLastfm(artist);
	} catch {
		return row ? JSON.parse(row.genres) : [];
	}

	upsertGenres.run(artist, JSON.stringify(fresh), Date.now());
	return fresh;
}
