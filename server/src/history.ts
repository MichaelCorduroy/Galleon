import db from "./database";

export interface PlayHistoryEntry {
	id: number;
	songId: number | null;
	title: string;
	artist: string;
	album: string;
	trackDuration: number | null;
	playedSeconds: number;
	playedAt: number;
}

interface SongRow {
	id: number;
	title: string;
	artist: string | null;
	album: string | null;
	duration: number | null;
}

const getSong = db.prepare(`SELECT id, title, artist, album, duration FROM songs WHERE id = ?`);

const insertPlay = db.prepare(`
	INSERT INTO play_history (song_id, title, artist, album, track_duration, played_seconds, played_at)
	VALUES (@songId, @title, @artist, @album, @trackDuration, @playedSeconds, @playedAt)
`);

// records one genuine listen (the frontend only calls this once a track
// crosses the scrobble-style threshold) — title/artist/album are snapshotted
// from the song's current row so history reads correctly even if the song is
// later retagged or removed from the library
export function logPlay(songId: number, playedSeconds: number): PlayHistoryEntry | null {
	const song = getSong.get(songId) as SongRow | undefined;
	if (!song) return null;

	const artist = song.artist ?? "Unknown Artist";
	const album = song.album ?? "Unknown Album";
	const playedAt = Date.now() - Math.round(playedSeconds * 1000);

	const result = insertPlay.run({
		songId: song.id,
		title: song.title,
		artist,
		album,
		trackDuration: song.duration ?? null,
		playedSeconds,
		playedAt,
	});

	return {
		id: Number(result.lastInsertRowid),
		songId: song.id,
		title: song.title,
		artist,
		album,
		trackDuration: song.duration ?? null,
		playedSeconds,
		playedAt,
	};
}

const listStmt = db.prepare(`
	SELECT
		id,
		song_id as songId,
		title,
		artist,
		album,
		track_duration as trackDuration,
		played_seconds as playedSeconds,
		played_at as playedAt
	FROM play_history
	ORDER BY played_at DESC
	LIMIT ?
`);

const MAX_HISTORY_LIMIT = 500;

export function listHistory(limit = 100): PlayHistoryEntry[] {
	return listStmt.all(Math.max(1, Math.min(limit, MAX_HISTORY_LIMIT))) as PlayHistoryEntry[];
}

export interface HistoryStats {
	totalPlays: number;
	totalSeconds: number;
	topArtists: { artist: string; plays: number; seconds: number }[];
	topSongs: { title: string; artist: string; plays: number; seconds: number }[];
}

const totalsStmt = db.prepare(`
	SELECT COUNT(*) as totalPlays, COALESCE(SUM(played_seconds), 0) as totalSeconds
	FROM play_history WHERE played_at >= ?
`);

const topArtistsStmt = db.prepare(`
	SELECT artist, COUNT(*) as plays, COALESCE(SUM(played_seconds), 0) as seconds
	FROM play_history WHERE played_at >= ?
	GROUP BY artist ORDER BY plays DESC LIMIT 10
`);

const topSongsStmt = db.prepare(`
	SELECT title, artist, COUNT(*) as plays, COALESCE(SUM(played_seconds), 0) as seconds
	FROM play_history WHERE played_at >= ?
	GROUP BY title, artist ORDER BY plays DESC LIMIT 10
`);

// pass days to window the stats (e.g. "last 30 days"); omit for all-time
export function getHistoryStats(days?: number): HistoryStats {
	const since = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;

	const totals = totalsStmt.get(since) as { totalPlays: number; totalSeconds: number };
	const topArtists = topArtistsStmt.all(since) as { artist: string; plays: number; seconds: number }[];
	const topSongs = topSongsStmt.all(since) as { title: string; artist: string; plays: number; seconds: number }[];

	return { totalPlays: totals.totalPlays, totalSeconds: totals.totalSeconds, topArtists, topSongs };
}

export interface ExploreSong {
	id: number;
	title: string;
	artist: string;
	album: string;
	duration: number;
	cover: string | null;
}

const topPlayedStmt = db.prepare(`
	SELECT s.id, s.title, s.artist, s.album, s.duration, s.cover, COUNT(*) as playCount
	FROM play_history p
	JOIN songs s ON s.id = p.song_id
	WHERE p.song_id IS NOT NULL
	GROUP BY p.song_id
	ORDER BY playCount DESC, MAX(p.played_at) DESC
	LIMIT ?
`);

// ranked by total listen count — the "most played" shelf on the explore page
export function getTopPlayedSongs(limit = 12): (ExploreSong & { playCount: number })[] {
	return topPlayedStmt.all(limit) as (ExploreSong & { playCount: number })[];
}

const recentlyPlayedStmt = db.prepare(`
	SELECT s.id, s.title, s.artist, s.album, s.duration, s.cover, MAX(p.played_at) as lastPlayedAt
	FROM play_history p
	JOIN songs s ON s.id = p.song_id
	WHERE p.song_id IS NOT NULL
	GROUP BY p.song_id
	ORDER BY lastPlayedAt DESC
	LIMIT ?
`);

// most recent distinct song per play, most recent first — the "jump back in" shelf
export function getRecentlyPlayedSongs(limit = 12): (ExploreSong & { lastPlayedAt: number })[] {
	return recentlyPlayedStmt.all(limit) as (ExploreSong & { lastPlayedAt: number })[];
}

const dailyListeningStmt = db.prepare(`SELECT played_at, played_seconds FROM play_history WHERE played_at >= ?`);

// day-bucketed listening totals for the last N days, oldest first, zero-filled
// for days with no plays — feeds the explore page's small bar chart
export function getDailyListening(days = 7): { date: string; seconds: number }[] {
	const since = Date.now() - days * 24 * 60 * 60 * 1000;
	const rows = dailyListeningStmt.all(since) as { played_at: number; played_seconds: number }[];

	const buckets = new Map<string, number>();
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		buckets.set(d.toISOString().slice(0, 10), 0);
	}
	for (const row of rows) {
		const key = new Date(row.played_at).toISOString().slice(0, 10);
		if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + row.played_seconds);
	}
	return Array.from(buckets.entries()).map(([date, seconds]) => ({ date, seconds }));
}
