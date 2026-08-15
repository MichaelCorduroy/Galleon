import type { ArtistSummary } from "../artists";
import { coverUrl } from "../api";
import { CoverArt } from "./CoverArt";

interface ArtistGridProps {
	artists: ArtistSummary[];
	onOpen: (artist: string) => void;
	emptyMessage: string;
}

export function ArtistGrid({ artists, onOpen, emptyMessage }: ArtistGridProps) {
	if (artists.length === 0) {
		return <div className="tracklist-empty">{emptyMessage}</div>;
	}

	return (
		<div className="album-grid">
			{artists.map((artist) => (
				<button key={artist.artist} className="album-card" onClick={() => onOpen(artist.artist)}>
					<CoverArt
						src={coverUrl(artist.cover)}
						alt={`${artist.artist}`}
						className="artist-card-avatar"
						iconSize={28}
					/>
					<span className="album-card-title">{artist.artist}</span>
					<span className="album-card-meta">
						{artist.albumCount} {artist.albumCount === 1 ? "album" : "albums"}
					</span>
				</button>
			))}
		</div>
	);
}
