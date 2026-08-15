import db from "./database";
import { findReleaseTracklist, searchRecordings } from "./musicbrainz";

export interface MissingTrackResult {
	title: string;
	duration: number | null;
	mbid: string | null;
	album: string;
	artist: string;
	cover: string | null;
}

export interface TracklistEntry {
	position: number;
	title: string;
	duration: number | null;
	mbid: string | null;
	owned: boolean;
	songId: number | null;
}

export interface Tracklist {
	album: string;
	artist: string;
	cover: string | null;
	mbid: string | null;
	tracks: TracklistEntry[];
}

export function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

const findAlbum = db.prepare(`SELECT id, mbid FROM mb_albums WHERE title = ? AND artist = ?`);
const insertAlbum = db.prepare(
	`INSERT INTO mb_albums (title, artist, mbid, cover, fetched_at) VALUES (?, ?, ?, ?, ?)`,
);
const insertTrack = db.prepare(
	`INSERT INTO mb_tracks (album_id, position, title, duration, mbid, song_id) VALUES (?, ?, ?, ?, ?, ?)`,
);
const tracksForAlbum = db.prepare(
	`SELECT position, title, duration, mbid, song_id as songId FROM mb_tracks WHERE album_id = ? ORDER BY position`,
);
const localSongsForAlbum = db.prepare(
	`SELECT id, title, duration, cover FROM songs WHERE artist = ? AND album = ?`,
);

// canonical tracklist for an album: cached MusicBrainz data merged with
// whichever tracks we actually have on disk. Falls back to just the local
// songs (all "owned") if MusicBrainz has no match for this release.
export async function getTracklist(artist: string, album: string): Promise<Tracklist> {
	const localSongs = localSongsForAlbum.all(artist, album) as {
		id: number;
		title: string;
		duration: number;
		cover: string | null;
	}[];
	const localCover = localSongs.find((s) => s.cover)?.cover ?? null;

	const existing = findAlbum.get(album, artist) as { id: number; mbid: string | null } | undefined;

	if (existing) {
		const cached = tracksForAlbum.all(existing.id) as {
			position: number;
			title: string;
			duration: number | null;
			mbid: string | null;
			songId: number | null;
		}[];
		if (cached.length > 0) {
			return {
				album,
				artist,
				cover: localCover,
				mbid: existing.mbid,
				tracks: cached.map((t) => ({ ...t, owned: t.songId !== null })),
			};
		}
		// previously cached with no MusicBrainz match — don't hammer the API
		// again, just present what we actually have locally
		return localOnlyTracklist(album, artist, localSongs, localCover);
	}

	let release;
	try {
		release = await findReleaseTracklist(artist, album);
	} catch {
		release = null;
	}

	if (!release) {
		insertAlbum.run(album, artist, null, localCover, Date.now());
		return localOnlyTracklist(album, artist, localSongs, localCover);
	}

	const albumRow = insertAlbum.run(album, artist, release.mbid, localCover, Date.now());
	const albumId = albumRow.lastInsertRowid as number;

	const byNormalizedTitle = new Map(localSongs.map((s) => [normalizeTitle(s.title), s]));

	const tracks: TracklistEntry[] = release.tracks.map((t) => {
		const match = byNormalizedTitle.get(normalizeTitle(t.title));
		insertTrack.run(albumId, t.position, t.title, match ? match.duration : t.duration, t.mbid, match?.id ?? null);
		return {
			position: t.position,
			title: t.title,
			duration: match ? match.duration : t.duration,
			mbid: t.mbid,
			owned: Boolean(match),
			songId: match?.id ?? null,
		};
	});

	return { album, artist, cover: localCover, mbid: release.mbid, tracks };
}

const cachedMissingSearch = db.prepare(
	`SELECT mb_tracks.title as title, mb_tracks.duration as duration, mb_tracks.mbid as mbid,
	        mb_albums.title as album, mb_albums.artist as artist, mb_albums.cover as cover
	 FROM mb_tracks
	 JOIN mb_albums ON mb_tracks.album_id = mb_albums.id
	 WHERE mb_tracks.song_id IS NULL
	   AND (mb_tracks.title LIKE ? OR mb_albums.artist LIKE ? OR mb_albums.title LIKE ?)
	 ORDER BY mb_albums.artist, mb_albums.title, mb_tracks.position
	 LIMIT 25`,
);
const allOwnedSongs = db.prepare(`SELECT title, artist FROM songs`);

// tracks not on disk that match a search query — combines whatever's
// already cached locally (instant) with a live MusicBrainz search across
// all music (so search isn't limited to artists we've already looked at)
export async function searchMissingTracks(query: string): Promise<MissingTrackResult[]> {
	const like = `%${query}%`;
	const cached = cachedMissingSearch.all(like, like, like) as MissingTrackResult[];

	let live: MissingTrackResult[] = [];
	try {
		const owned = allOwnedSongs.all() as { title: string; artist: string }[];
		const ownedSet = new Set(owned.map((s) => `${normalizeTitle(s.title)}::${normalizeTitle(s.artist)}`));

		const recordings = await searchRecordings(query, 20);
		live = recordings
			.filter((r) => !ownedSet.has(`${normalizeTitle(r.title)}::${normalizeTitle(r.artist)}`))
			.map((r) => ({
				title: r.title,
				duration: r.duration,
				mbid: r.mbid,
				album: r.album ?? "Unknown Album",
				artist: r.artist,
				cover: null,
			}));
	} catch {
		// MusicBrainz unreachable/rate-limited — fall back to cache only
	}

	const seen = new Set<string>();
	const merged: MissingTrackResult[] = [];
	for (const track of [...cached, ...live]) {
		const key = `${normalizeTitle(track.title)}::${normalizeTitle(track.artist)}::${normalizeTitle(track.album)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		merged.push(track);
	}

	return merged.slice(0, 30);
}

function localOnlyTracklist(
	album: string,
	artist: string,
	localSongs: { id: number; title: string; duration: number }[],
	cover: string | null,
): Tracklist {
	return {
		album,
		artist,
		cover,
		mbid: null,
		tracks: localSongs.map((s, i) => ({
			position: i + 1,
			title: s.title,
			duration: s.duration,
			mbid: null,
			owned: true,
			songId: s.id,
		})),
	};
}
