// MusicBrainz requires a descriptive User-Agent identifying the app (and
// ideally a contact) — see https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const USER_AGENT = "Galleon/1.0 ( self-hosted music streaming app )";
const BASE = "https://musicbrainz.org/ws/2";

// MusicBrainz asks for no more than ~1 request/second from a single client;
// queue every call through here so concurrent lookups don't burst past that
let queue: Promise<unknown> = Promise.resolve();
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
	const run = queue.then(async () => {
		const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastRequestAt = Date.now();
		return fn();
	});
	// keep the queue alive even if this particular call rejects
	queue = run.catch(() => {});
	return run;
}

async function mbFetch(url: string): Promise<any> {
	return rateLimited(async () => {
		const res = await fetch(url, {
			headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
		});
		if (!res.ok) throw new Error(`MusicBrainz request failed: ${res.status} ${res.statusText}`);
		return res.json();
	});
}

export interface MBTrack {
	position: number;
	title: string;
	duration: number | null;
	mbid: string | null;
}

export interface MBRelease {
	mbid: string;
	title: string;
	cover: string | null;
	tracks: MBTrack[];
}

function escapeLucene(value: string): string {
	return value.replace(/["\\]/g, "\\$&");
}

export interface MBRecordingResult {
	title: string;
	artist: string;
	album: string | null;
	duration: number | null;
	mbid: string;
}

// broad "any music" search — used so search can surface tracks we've never
// looked at before, not just artists/albums already cached locally
export async function searchRecordings(query: string, limit = 15): Promise<MBRecordingResult[]> {
	const url = `${BASE}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
	const data = await mbFetch(url);

	const results: MBRecordingResult[] = [];
	for (const rec of data.recordings ?? []) {
		const artist = rec["artist-credit"]?.[0]?.name ?? rec["artist-credit"]?.[0]?.artist?.name ?? null;
		if (!artist) continue;
		const release = rec.releases?.[0];
		results.push({
			title: rec.title,
			artist,
			album: release?.title ?? null,
			duration: typeof rec.length === "number" ? rec.length / 1000 : null,
			mbid: rec.id,
		});
	}
	return results;
}

export async function findReleaseTracklist(artist: string, album: string): Promise<MBRelease | null> {
	const query = `release:"${escapeLucene(album)}" AND artist:"${escapeLucene(artist)}"`;
	const searchUrl = `${BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
	const searchData = await mbFetch(searchUrl);

	const candidates: { id: string }[] = searchData.releases ?? [];

	// the public MusicBrainz server occasionally 503s on individual releases
	// (independent of our own request rate) — fall through to the next
	// best-scoring candidate rather than giving up on the first failure
	for (const candidate of candidates.slice(0, 3)) {
		let releaseData: any;
		try {
			releaseData = await mbFetch(`${BASE}/release/${candidate.id}?inc=recordings&fmt=json`);
		} catch {
			continue;
		}

		const tracks: MBTrack[] = [];
		let position = 0;
		for (const medium of releaseData.media ?? []) {
			for (const track of medium.tracks ?? []) {
				position += 1;
				tracks.push({
					position,
					title: track.title,
					duration: typeof track.length === "number" ? track.length / 1000 : null,
					mbid: track.recording?.id ?? null,
				});
			}
		}

		if (tracks.length === 0) continue;

		return {
			mbid: releaseData.id,
			title: releaseData.title,
			cover: null,
			tracks,
		};
	}

	return null;
}
