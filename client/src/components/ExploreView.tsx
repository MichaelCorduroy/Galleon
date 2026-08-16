import { useMemo, useState, type CSSProperties } from "react";
import type { Album, ExploreData, GenreWebAlbum, Song } from "../api";
import { coverUrl, downloadKey } from "../api";
import { Carousel } from "./Carousel";
import { CoverArt } from "./CoverArt";
import { GenreWeb } from "./GenreWeb";
import { LikeButton } from "./LikeButton";
import { ShuffleIcon } from "../icons";
import { formatListeningTime } from "../format";

interface ExploreViewProps {
	explore: ExploreData | null;
	loading: boolean;
	discover: Song[];
	discoverLoading: boolean;
	albums: Album[];
	library: Song[];
	likedPreview: Song[];
	likedIds: Set<number>;
	onToggleLike: (songId: number) => void;
	onShuffleLibrary: () => void;
	onPlaySong: (list: Song[], index: number) => void;
	onOpenAlbum: (album: Album) => void;
	onOpenAlbumFromSong: (song: Song) => void;
	onOpenArtist: (artist: string) => void;
	onSeeLiked: () => void;
	onBrowseLibrary: () => void;
	onPlayPath: (songs: Song[]) => void;
	onQueuePath: (songs: Song[]) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CRATE_SIZE = 20;

function dayLabel(dateStr: string): string {
	// dates are stored/produced as local-time YYYY-MM-DD buckets — parsing
	// with an explicit local constructor avoids the UTC-shift that
	// `new Date("YYYY-MM-DD")` would otherwise introduce
	const [y, m, d] = dateStr.split("-").map(Number);
	return DAY_LABELS[new Date(y, m - 1, d).getDay()];
}

function Divider() {
	return <div className="explore-divider" />;
}

export function ExploreView({
	explore,
	loading,
	discover,
	discoverLoading,
	albums,
	library,
	likedPreview,
	likedIds,
	onToggleLike,
	onShuffleLibrary,
	onPlaySong,
	onOpenAlbum,
	onOpenAlbumFromSong,
	onOpenArtist,
	onSeeLiked,
	onBrowseLibrary,
	onPlayPath,
	onQueuePath,
}: ExploreViewProps) {
	const [showGenreWeb, setShowGenreWeb] = useState(true);
	const openGenreWebAlbum = (a: GenreWebAlbum) => onOpenAlbum({ album: a.album, artist: a.artist, cover: a.cover, tracks: 0 });

	// stable-ish random sample + tilt for the crate-digging shelf — reshuffles
	// only when the album list itself changes, not on every render
	const crate = useMemo(() => {
		const shuffled = [...albums].sort(() => Math.random() - 0.5).slice(0, CRATE_SIZE);
		return shuffled.map((album) => ({ album, rotation: Math.random() * 10 - 5 }));
	}, [albums]);

	const maxDaySeconds = Math.max(1, ...(explore?.dailyListening.map((d) => d.seconds) ?? [1]));
	const maxArtistPlays = Math.max(1, ...(explore?.topArtists.map((a) => a.plays) ?? [1]));

	return (
		<div className="content-view explore-view">
			<div className="explore-hero">
				<div>
					<div className="explore-hero-title">Explore</div>
					<div className="explore-hero-subtitle">
						Your library, rediscovered.{" "}
						<button className="link-btn" onClick={onBrowseLibrary}>
							Browse full library →
						</button>
					</div>
				</div>
				<button className="shuffle-hero-btn" onClick={onShuffleLibrary} disabled={albums.length === 0}>
					<ShuffleIcon size={16} />
					Shuffle my library
				</button>
			</div>

			<div className="genre-web-section">
				<div className="explore-shelf-header">
					<div className="search-section-title">Genre web</div>
					<button className="text-btn" onClick={() => setShowGenreWeb((v) => !v)}>
						{showGenreWeb ? "Hide" : "Show"}
					</button>
				</div>
				{showGenreWeb && (
					<GenreWeb
						library={library}
						onOpenAlbum={openGenreWebAlbum}
						onPlayPath={onPlayPath}
						onQueuePath={onQueuePath}
					/>
				)}
			</div>
			<Divider />

			{crate.length > 0 && (
				<>
					<div className="crate-section">
						<div className="search-section-title">The crate</div>
						<div className="crate-scroll">
							{crate.map(({ album, rotation }, i) => (
								<button
									key={`${album.artist}::${album.album}`}
									className="crate-tile"
									style={{ "--tilt": `${rotation}deg`, "--i": i } as CSSProperties}
									onClick={() => onOpenAlbum(album)}
									title={`${album.album} · ${album.artist}`}
								>
									<CoverArt
										src={coverUrl(album.cover)}
										alt={`${album.album} cover`}
										className="cover-art-crate"
										iconSize={20}
									/>
								</button>
							))}
						</div>
					</div>
					<Divider />
				</>
			)}

			{loading && <div className="tracklist-empty">Loading…</div>}

			{explore && explore.recentlyPlayed.length > 0 && (
				<>
					<Shelf
						title="Jump back in"
						songs={explore.recentlyPlayed}
						likedIds={likedIds}
						onToggleLike={onToggleLike}
						onPlaySong={onPlaySong}
						onOpenAlbum={onOpenAlbumFromSong}
					/>
					<Divider />
				</>
			)}

			{explore && explore.topPlayed.length > 0 && (
				<>
					<Shelf
						title="Most played"
						songs={explore.topPlayed}
						likedIds={likedIds}
						onToggleLike={onToggleLike}
						onPlaySong={onPlaySong}
						onOpenAlbum={onOpenAlbumFromSong}
					/>
					<Divider />
				</>
			)}

			{!discoverLoading && discover.length > 0 && (
				<>
					<Shelf
						title="Based on your taste"
						songs={discover}
						likedIds={likedIds}
						onToggleLike={onToggleLike}
						onPlaySong={onPlaySong}
						onOpenAlbum={onOpenAlbumFromSong}
					/>
					<Divider />
				</>
			)}

			<div className="search-section">
				<div className="explore-shelf-header">
					<div className="search-section-title">Liked songs</div>
					{likedPreview.length > 0 && (
						<button className="text-btn" onClick={onSeeLiked}>
							See all
						</button>
					)}
				</div>
				{likedPreview.length === 0 ? (
					<div className="search-empty explore-liked-empty">
						No liked songs yet — tap the heart on any track to save it here.
					</div>
				) : (
					<Shelf
						title=""
						songs={likedPreview}
						likedIds={likedIds}
						onToggleLike={onToggleLike}
						onPlaySong={onPlaySong}
						onOpenAlbum={onOpenAlbumFromSong}
						hideTitle
					/>
				)}
			</div>

			{explore && (explore.dailyListening.some((d) => d.seconds > 0) || explore.topArtists.length > 0) && (
				<>
					<Divider />
					<div className="explore-stats-row">
						<div className="search-section history-stats-col">
							<div className="search-section-title">Listening — last 7 days</div>
							<div className="listening-chart">
								{explore.dailyListening.map((d) => (
									<div className="listening-chart-col" key={d.date}>
										<div
											className="listening-chart-bar"
											style={{ height: `${Math.max(4, (d.seconds / maxDaySeconds) * 100)}%` }}
											title={formatListeningTime(d.seconds)}
										/>
										<span className="listening-chart-label">{dayLabel(d.date)}</span>
									</div>
								))}
							</div>
						</div>

						{explore.topArtists.length > 0 && (
							<div className="search-section history-stats-col">
								<div className="search-section-title">Top artists · 30d</div>
								<div className="history-rank-list">
									{explore.topArtists.map((a, i) => (
										<button
											key={a.artist}
											className="history-rank-row artist-bar-row"
											onClick={() => onOpenArtist(a.artist)}
										>
											<span className="history-rank-num">{i + 1}</span>
											<span className="history-rank-name">{a.artist}</span>
											<span className="artist-bar-track">
												<span
													className="artist-bar-fill"
													style={{ width: `${(a.plays / maxArtistPlays) * 100}%` }}
												/>
											</span>
											<span className="history-rank-count">{a.plays}</span>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}

interface ShelfProps {
	title: string;
	songs: Song[];
	likedIds: Set<number>;
	onToggleLike: (songId: number) => void;
	onPlaySong: (list: Song[], index: number) => void;
	onOpenAlbum: (song: Song) => void;
	hideTitle?: boolean;
}

function Shelf({ title, songs, likedIds, onToggleLike, onPlaySong, onOpenAlbum, hideTitle }: ShelfProps) {
	return (
		<div className="search-section">
			{!hideTitle && <div className="search-section-title">{title}</div>}
			<Carousel trackClassName="shelf-row">
				{songs.map((song, i) => (
					<div key={`${downloadKey(song.artist, song.album, song.title)}::${song.id}`} className="shelf-tile">
						<button className="shelf-tile-art" onClick={() => onPlaySong(songs, i)} aria-label={`Play ${song.title}`}>
							<CoverArt src={coverUrl(song.cover)} alt={`${song.album} cover`} className="cover-art-shelf" iconSize={22} />
						</button>
						<div className="shelf-tile-info">
							<button className="shelf-tile-title" onClick={() => onOpenAlbum(song)}>
								{song.title}
							</button>
							<span className="shelf-tile-artist">{song.artist}</span>
						</div>
						<LikeButton liked={likedIds.has(song.id)} onToggle={() => onToggleLike(song.id)} small />
					</div>
				))}
			</Carousel>
		</div>
	);
}
