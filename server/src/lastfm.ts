import db from "./database";

const BASE = "https://ws.audioscrobbler.com/2.0/";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — similar-artist data barely shifts

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
