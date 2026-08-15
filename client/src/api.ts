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
