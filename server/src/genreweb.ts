import db from "./database";
import { CACHE_TTL_MS, getTopTags } from "./lastfm";

export interface GenreWebAlbum {
	album: string;
	artist: string;
	cover: string | null;
	genres: string[];
}

export interface GenreWebData {
	albums: GenreWebAlbum[];
	genres: string[];
}

const albumsStmt = db.prepare(`
	SELECT album, artist, MAX(cover) as cover
	FROM songs
	GROUP BY album, artist
	ORDER BY album, artist
`);

const genreCacheCheck = db.prepare(`SELECT fetched_at FROM artist_genres WHERE artist = ?`);

function isFreshlyCached(artist: string): boolean {
	const row = genreCacheCheck.get(artist) as { fetched_at: number } | undefined;
	return !!row && Date.now() - row.fetched_at < CACHE_TTL_MS;
}

// only a real live Last.fm hit needs to be polite about pacing — once every
// artist is cached, this endpoint is just DB reads and responds instantly
const FETCH_DELAY_MS = 250;

// every owned album, tagged with its artist's Last.fm genres — the data set
// the 3D genre web renders. Bulk-warms the artist_genres cache the first time
// (or whenever an artist's cache expires), then serves from cache thereafter
export async function getGenreWebData(): Promise<GenreWebData> {
	const rows = albumsStmt.all() as { album: string; artist: string; cover: string | null }[];

	const artists = Array.from(new Set(rows.map((r) => r.artist)));
	const genresByArtist = new Map<string, string[]>();

	for (const artist of artists) {
		const wasCached = isFreshlyCached(artist);
		const tags = await getTopTags(artist);
		genresByArtist.set(artist, tags);
		if (!wasCached) await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
	}

	const albums: GenreWebAlbum[] = rows.map((r) => ({
		album: r.album,
		artist: r.artist,
		cover: r.cover,
		genres: genresByArtist.get(r.artist) ?? [],
	}));

	const allGenres = new Set<string>();
	for (const tags of genresByArtist.values()) {
		for (const genre of tags) allGenres.add(genre);
	}

	return { albums, genres: Array.from(allGenres).sort() };
}
