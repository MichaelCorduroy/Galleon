import type { Album } from "./api";

export interface ArtistSummary {
	artist: string;
	albumCount: number;
	cover: string | null;
}

export function deriveArtists(albums: Album[]): ArtistSummary[] {
	const byName = new Map<string, ArtistSummary>();

	for (const album of albums) {
		const existing = byName.get(album.artist);
		if (existing) {
			existing.albumCount += 1;
			if (!existing.cover && album.cover) existing.cover = album.cover;
		} else {
			byName.set(album.artist, { artist: album.artist, albumCount: 1, cover: album.cover });
		}
	}

	return Array.from(byName.values()).sort((a, b) => a.artist.localeCompare(b.artist));
}
