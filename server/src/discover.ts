import db from "./database";
import { getHistoryStats } from "./history";
import { getSimilarArtists } from "./lastfm";

export interface DiscoverSong {
	id: number;
	title: string;
	artist: string;
	album: string;
	duration: number;
	cover: string | null;
}

const TOP_ARTIST_SAMPLE = 5;

// "based on your taste" — takes your top artists from listening history,
// asks Last.fm who's similar, then surfaces songs you already own by those
// similar artists (excluding the top artists themselves, since those are
// already covered by the "most played" shelf) — a lightweight recommender
// built entirely from data already on hand, no new library required
export async function getDiscoverPlaylist(limit = 12): Promise<DiscoverSong[]> {
	const topArtists = getHistoryStats(30).topArtists.slice(0, TOP_ARTIST_SAMPLE).map((a) => a.artist);
	if (topArtists.length === 0) return [];

	const similarLists = await Promise.all(topArtists.map((artist) => getSimilarArtists(artist).catch(() => [])));

	const candidates = new Set<string>();
	for (const list of similarLists) {
		for (const s of list) candidates.add(s.name);
	}
	for (const artist of topArtists) candidates.delete(artist);
	if (candidates.size === 0) return [];

	const names = Array.from(candidates);
	const placeholders = names.map(() => "artist = ? COLLATE NOCASE").join(" OR ");

	const rows = db
		.prepare(
			`SELECT id, title, artist, album, duration, cover FROM songs WHERE ${placeholders} ORDER BY RANDOM() LIMIT ?`,
		)
		.all(...names, limit);

	return rows as DiscoverSong[];
}
