import type { Album } from "../api";
import { coverUrl } from "../api";
import { CoverArt } from "./CoverArt";

interface AlbumGridProps {
	albums: Album[];
	onOpen: (album: Album) => void;
	emptyMessage: string;
}

export function AlbumGrid({ albums, onOpen, emptyMessage }: AlbumGridProps) {
	if (albums.length === 0) {
		return <div className="tracklist-empty">{emptyMessage}</div>;
	}

	return (
		<div className="album-grid">
			{albums.map((album) => (
				<button key={`${album.artist}::${album.album}`} className="album-card" onClick={() => onOpen(album)}>
					<CoverArt
						src={coverUrl(album.cover)}
						alt={`${album.album} cover`}
						className="cover-art-album"
						iconSize={28}
					/>
					<span className="album-card-title">{album.album}</span>
					<span className="album-card-meta">
						{album.artist} · {album.tracks} {album.tracks === 1 ? "track" : "tracks"}
					</span>
				</button>
			))}
		</div>
	);
}
