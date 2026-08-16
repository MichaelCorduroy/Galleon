import { useEffect, useMemo, useState } from "react";
import type { Album, GenreWebAlbum, MissingTrack, Song } from "../api";
import { coverUrl, downloadKey, searchMissingTracks } from "../api";
import type { ArtistSummary } from "../artists";
import { CoverArt } from "./CoverArt";
import { DownloadButton } from "./DownloadButton";
import { LikeButton } from "./LikeButton";
import { PlusIcon } from "../icons";
import { formatTime } from "../format";

interface SearchResultsProps {
	query: string;
	library: Song[];
	albums: Album[];
	artists: ArtistSummary[];
	genreAlbums: GenreWebAlbum[];
	onClear: () => void;
	onPlaySong: (list: Song[], index: number) => void;
	onAddToQueue: (song: Song) => void;
	onOpenAlbum: (album: Album) => void;
	onOpenArtist: (artist: string) => void;
	downloadingKeys: Set<string>;
	onDownload: (artist: string, album: string, title: string) => void;
	likedIds: Set<number>;
	onToggleLike: (songId: number) => void;
}

export function SearchResults({
	query,
	library,
	albums,
	artists,
	genreAlbums,
	onClear,
	onPlaySong,
	onAddToQueue,
	onOpenAlbum,
	onOpenArtist,
	downloadingKeys,
	onDownload,
	likedIds,
	onToggleLike,
}: SearchResultsProps) {
	const q = query.trim().toLowerCase();

	const matchingSongs = useMemo(
		() =>
			library.filter(
				(s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q),
			),
		[library, q],
	);
	const matchingAlbums = useMemo(
		() => albums.filter((a) => a.album.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)),
		[albums, q],
	);
	const matchingArtists = useMemo(() => artists.filter((a) => a.artist.toLowerCase().includes(q)), [artists, q]);

	// groups owned albums by whichever of their Last.fm genre tags matched —
	// e.g. typing "electro" surfaces a "Genre: electronic" shelf of albums
	// carrying that tag, even if the album/artist name itself doesn't match
	const genreMatches = useMemo(() => {
		if (!q) return [];
		const byGenre = new Map<string, GenreWebAlbum[]>();
		for (const album of genreAlbums) {
			for (const g of album.genres) {
				if (!g.toLowerCase().includes(q)) continue;
				const list = byGenre.get(g);
				if (list) list.push(album);
				else byGenre.set(g, [album]);
			}
		}
		return Array.from(byGenre.entries());
	}, [genreAlbums, q]);

	// tracks we know about (from previously-viewed MusicBrainz tracklists)
	// but don't have a file for — debounced since it's a network round trip
	const [missingTracks, setMissingTracks] = useState<MissingTrack[]>([]);
	useEffect(() => {
		if (!q) {
			setMissingTracks([]);
			return;
		}
		let cancelled = false;
		const timer = setTimeout(() => {
			searchMissingTracks(q)
				.then((tracks) => {
					if (!cancelled) setMissingTracks(tracks);
				})
				.catch(() => {});
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [q]);

	const hasResults =
		matchingSongs.length > 0 ||
		matchingAlbums.length > 0 ||
		matchingArtists.length > 0 ||
		missingTracks.length > 0 ||
		genreMatches.length > 0;

	return (
		<div className="content-view">
			<div className="search-results-header">
				<span className="search-results-title">Results for &ldquo;{query}&rdquo;</span>
				<button className="text-btn" onClick={onClear}>
					Clear
				</button>
			</div>

			{!hasResults && <div className="search-empty">No matches for &ldquo;{query}&rdquo;.</div>}

			{matchingArtists.length > 0 && (
				<div className="search-section">
					<div className="search-section-title">Artists</div>
					{matchingArtists.map((a) => (
						<button key={a.artist} className="artist-row" onClick={() => onOpenArtist(a.artist)}>
							<span className="artist-row-name">{a.artist}</span>
							<span className="artist-row-meta">
								{a.albumCount} {a.albumCount === 1 ? "album" : "albums"}
							</span>
						</button>
					))}
				</div>
			)}

			{matchingAlbums.length > 0 && (
				<div className="search-section">
					<div className="search-section-title">Albums</div>
					<div className="album-grid">
						{matchingAlbums.map((album) => (
							<button
								key={`${album.artist}::${album.album}`}
								className="album-card"
								onClick={() => onOpenAlbum(album)}
							>
								<CoverArt
									src={coverUrl(album.cover)}
									alt={`${album.album} cover`}
									className="cover-art-album"
									iconSize={24}
								/>
								<span className="album-card-title">{album.album}</span>
								<span className="album-card-meta">{album.artist}</span>
							</button>
						))}
					</div>
				</div>
			)}

			{genreMatches.map(([genre, matchedAlbums]) => (
				<div key={genre} className="search-section">
					<div className="search-section-title">Genre: {genre}</div>
					<div className="album-grid">
						{matchedAlbums.map((album) => (
							<button
								key={`${album.artist}::${album.album}`}
								className="album-card"
								onClick={() => onOpenAlbum({ album: album.album, artist: album.artist, cover: album.cover, tracks: 0 })}
							>
								<CoverArt
									src={coverUrl(album.cover)}
									alt={`${album.album} cover`}
									className="cover-art-album"
									iconSize={24}
								/>
								<span className="album-card-title">{album.album}</span>
								<span className="album-card-meta">{album.artist}</span>
							</button>
						))}
					</div>
				</div>
			))}

			{matchingSongs.length > 0 && (
				<div className="search-section">
					<div className="search-section-title">Songs</div>
					<div className="tracklist-rows">
						{matchingSongs.map((song, i) => (
							<div key={song.id} className="track-row">
								<button
									className="track-row-cover"
									onClick={() => onPlaySong(matchingSongs, i)}
									aria-label={`Play ${song.title}`}
								>
									<CoverArt src={coverUrl(song.cover)} alt={`${song.album} cover`} className="cover-art-sm" iconSize={14} />
								</button>
								<div className="track-row-main">
									<button
										className="track-title-link"
										onClick={() =>
											onOpenAlbum({ album: song.album, artist: song.artist, tracks: 0, cover: song.cover })
										}
									>
										{song.title}
									</button>
									<button className="track-artist track-artist-link" onClick={() => onOpenArtist(song.artist)}>
										{song.artist}
									</button>
								</div>
								<span className="track-duration">{formatTime(song.duration)}</span>
								<LikeButton liked={likedIds.has(song.id)} onToggle={() => onToggleLike(song.id)} small />
								<button
									className="icon-btn track-add-btn"
									onClick={() => onAddToQueue(song)}
									aria-label="Add to queue"
									title="Add to queue"
								>
									<PlusIcon size={13} />
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{missingTracks.length > 0 && (
				<div className="search-section">
					<div className="search-section-title">Not in your library</div>
					<div className="tracklist-rows">
						{missingTracks.map((track, i) => (
							<div key={`${track.artist}::${track.album}::${track.title}::${i}`} className="track-row track-row-missing">
								<CoverArt
									src={coverUrl(track.cover)}
									alt={`${track.album} cover`}
									className="cover-art-sm"
									iconSize={14}
								/>
								<button
									className="track-row-main"
									onClick={() => onOpenAlbum({ album: track.album, artist: track.artist, tracks: 0, cover: track.cover })}
								>
									<span className="track-title">{track.title}</span>
									<span className="track-artist">
										{track.artist} · {track.album}
									</span>
								</button>
								<span className="track-duration">{formatTime(track.duration ?? 0)}</span>
								<DownloadButton
									title={`Download "${track.title}"`}
									small
									downloading={downloadingKeys.has(downloadKey(track.artist, track.album, track.title))}
									onDownload={() => onDownload(track.artist, track.album, track.title)}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
