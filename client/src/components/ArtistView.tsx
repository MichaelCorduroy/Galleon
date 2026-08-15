import { useEffect, useState } from "react";
import type { Album, SimilarArtist } from "../api";
import { fetchSimilarArtists } from "../api";
import { ChevronLeftIcon } from "../icons";
import { AlbumGrid } from "./AlbumGrid";

interface ArtistViewProps {
	artist: string;
	albums: Album[];
	onBack: () => void;
	onOpenAlbum: (album: Album) => void;
	onSearchArtist: (name: string) => void;
}

export function ArtistView({ artist, albums, onBack, onOpenAlbum, onSearchArtist }: ArtistViewProps) {
	const totalTracks = albums.reduce((sum, a) => sum + a.tracks, 0);

	const [similar, setSimilar] = useState<SimilarArtist[]>([]);
	useEffect(() => {
		let cancelled = false;
		fetchSimilarArtists(artist).then((result) => {
			if (!cancelled) setSimilar(result);
		});
		return () => {
			cancelled = true;
		};
	}, [artist]);

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

			{similar.length > 0 && (
				<div className="search-section">
					<div className="search-section-title">Similar artists</div>
					<div className="similar-artist-chips">
						{similar.map((a) => (
							<button key={a.name} className="similar-artist-chip" onClick={() => onSearchArtist(a.name)}>
								{a.name}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
