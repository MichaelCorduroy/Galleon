// Use whatever host the page was loaded from (works both on localhost during
// dev and when reached over the LAN, e.g. from a phone hitting the server's
// IP) rather than hardcoding localhost, which only resolves on the machine
// running the browser.
export const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000`;

export interface Song {
	id: number;
	title: string;
	artist: string;
	album: string;
	duration: number;
	cover: string | null;
}

export interface Album {
	album: string;
	artist: string;
	tracks: number;
	cover: string | null;
}

export interface TracklistTrack {
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
	tracks: TracklistTrack[];
}

export interface MissingTrack {
	title: string;
	duration: number | null;
	mbid: string | null;
	album: string;
	artist: string;
	cover: string | null;
}

export interface SimilarArtist {
	name: string;
	match: number;
}

// retries a flaky fetch a few times with a short delay — mainly for the
// initial page load, where the backend may still be booting (e.g. right
// after a restart) and would otherwise leave the library empty forever
// since a rejected fetch on mount is never retried on its own
export async function withRetry<T>(fn: () => Promise<T>, attempts = 10, delayMs = 1500): Promise<T> {
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (attempt === attempts) throw err;
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
	throw new Error("unreachable");
}

export async function fetchSongs(): Promise<Song[]> {
	const res = await fetch(`${API_BASE}/songs`);
	return res.json();
}

export async function fetchAlbums(): Promise<Album[]> {
	const res = await fetch(`${API_BASE}/albums`);
	return res.json();
}

// canonical tracklist merging what's owned locally with the full MusicBrainz
// release (missing tracks come back with owned:false, songId:null)
export async function fetchTracklist(album: string, artist: string): Promise<Tracklist> {
	const res = await fetch(
		`${API_BASE}/albums/${encodeURIComponent(album)}/tracklist?artist=${encodeURIComponent(artist)}`,
	);
	if (!res.ok) throw new Error(`Failed to load tracklist (${res.status})`);
	return res.json();
}

// tracks we know about (from previously-viewed MusicBrainz tracklists) but
// don't actually have a file for — lets search surface gaps, not just what's
// on disk
export async function searchMissingTracks(query: string): Promise<MissingTrack[]> {
	const res = await fetch(`${API_BASE}/search/missing?q=${encodeURIComponent(query)}`);
	return res.json();
}

export async function fetchSimilarArtists(artist: string): Promise<SimilarArtist[]> {
	const res = await fetch(`${API_BASE}/artists/${encodeURIComponent(artist)}/similar`);
	if (!res.ok) return [];
	return res.json();
}

export interface DownloadResponse {
	success: boolean;
	songId?: number;
	error?: string;
}

// shared key format for tracking in-flight downloads by (artist, album,
// title) — used by App.tsx's download state and every component that reads
// it, so they need to agree on the exact same string shape
export function downloadKey(artist: string, album: string, title: string): string {
	return `${artist}::${album}::${title}`;
}

export async function downloadTrack(artist: string, album: string, title: string): Promise<DownloadResponse> {
	const res = await fetch(`${API_BASE}/download`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ artist, album, title }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) return { success: false, error: data.error ?? `Request failed (${res.status})` };
	return data;
}

export async function scanLibrary(): Promise<Song[]> {
	const res = await fetch(`${API_BASE}/scan`);
	return res.json();
}

export function streamUrl(id: number): string {
	return `${API_BASE}/stream/${id}`;
}

export function coverUrl(cover: string | null): string | undefined {
	return cover ? `${API_BASE}/covers/${cover}` : undefined;
}

export interface DownloadJob {
	id: number;
	artist: string;
	album: string;
	title: string;
	status: "pending" | "downloading" | "success" | "failed";
	error?: string;
	startedAt: number;
	finishedAt?: number;
}

export async function fetchDownloadJobs(): Promise<DownloadJob[]> {
	const res = await fetch(`${API_BASE}/downloads`);
	if (!res.ok) return [];
	return res.json();
}

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

export interface HistoryStats {
	totalPlays: number;
	totalSeconds: number;
	topArtists: { artist: string; plays: number; seconds: number }[];
	topSongs: { title: string; artist: string; plays: number; seconds: number }[];
}

// fire-and-forget — logging a play should never interrupt playback if it fails
export function logPlay(songId: number, playedSeconds: number): void {
	fetch(`${API_BASE}/history`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ songId, playedSeconds }),
	}).catch(() => {});
}

export async function fetchHistory(limit = 100): Promise<PlayHistoryEntry[]> {
	const res = await fetch(`${API_BASE}/history?limit=${limit}`);
	if (!res.ok) return [];
	return res.json();
}

export async function fetchHistoryStats(days?: number): Promise<HistoryStats | null> {
	const res = await fetch(`${API_BASE}/history/stats${days ? `?days=${days}` : ""}`);
	if (!res.ok) return null;
	return res.json();
}

export interface LikedSong extends Song {
	likedAt: number;
}

export async function likeSong(songId: number): Promise<void> {
	await fetch(`${API_BASE}/songs/${songId}/like`, { method: "POST" }).catch(() => {});
}

export async function unlikeSong(songId: number): Promise<void> {
	await fetch(`${API_BASE}/songs/${songId}/like`, { method: "DELETE" }).catch(() => {});
}

export async function fetchLikedSongs(): Promise<LikedSong[]> {
	const res = await fetch(`${API_BASE}/liked-songs`);
	if (!res.ok) return [];
	return res.json();
}

export interface ExploreData {
	topPlayed: (Song & { playCount: number })[];
	recentlyPlayed: (Song & { lastPlayedAt: number })[];
	dailyListening: { date: string; seconds: number }[];
	topArtists: { artist: string; plays: number; seconds: number }[];
}

export async function fetchExplore(): Promise<ExploreData | null> {
	const res = await fetch(`${API_BASE}/explore`);
	if (!res.ok) return null;
	return res.json();
}

// "based on your taste" — songs you own by artists similar to your top
// played artists, via Last.fm; separate call so a slow/unconfigured Last.fm
// doesn't hold up the rest of the explore page
export async function fetchDiscover(limit = 12): Promise<Song[]> {
	const res = await fetch(`${API_BASE}/discover?limit=${limit}`);
	if (!res.ok) return [];
	return res.json();
}
