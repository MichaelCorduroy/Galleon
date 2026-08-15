import type { Album } from "../api";
import { ChevronLeftIcon } from "../icons";
import { AlbumGrid } from "./AlbumGrid";

interface ArtistViewProps {
	artist: string;
	albums: Album[];
	onBack: () => void;
	onOpenAlbum: (album: Album) => void;
}

export function ArtistView({ artist, albums, onBack, onOpenAlbum }: ArtistViewProps) {
	const totalTracks = albums.reduce((sum, a) => sum + a.tracks, 0);

	return (
		<div className="content-view">
			<button className="text-btn back-link" onClick={onBack}>
				<ChevronLeftIcon size={13} />
				Library
			</button>

			<div className="view-title">{artist}</div>
			<div className="view-meta view-meta-spaced">
				{albums.length} {albums.length === 1 ? "album" : "albums"} · {totalTracks} tracks
			</div>

			<AlbumGrid albums={albums} onOpen={onOpenAlbum} emptyMessage="No albums found." />
		</div>
	);
}
