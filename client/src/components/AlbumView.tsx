import type { DragEvent } from "react";
import type { Album, Song } from "../api";
import { coverUrl } from "../api";
import { CoverArt } from "./CoverArt";
import { ChevronLeftIcon, PlayIcon, PlusIcon } from "../icons";
import { SONG_DRAG_MIME } from "../dnd";
import { formatDuration, formatTime } from "../format";

interface AlbumViewProps {
	album: Album;
	songs: Song[];
	loading: boolean;
	currentSongId?: number;
	onBack: () => void;
	onPlayAll: () => void;
	onSelect: (index: number) => void;
	onAddToQueue: (song: Song) => void;
	onOpenArtist: (artist: string) => void;
}

export function AlbumView({
	album,
	songs,
	loading,
	currentSongId,
	onBack,
	onPlayAll,
	onSelect,
	onAddToQueue,
	onOpenArtist,
}: AlbumViewProps) {
	const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

	const handleDragStart = (e: DragEvent, song: Song) => {
		e.dataTransfer.setData(SONG_DRAG_MIME, JSON.stringify(song));
		e.dataTransfer.effectAllowed = "copy";
	};

	return (
		<div className="content-view">
			<button className="text-btn back-link" onClick={onBack}>
				<ChevronLeftIcon size={13} />
				Library
			</button>

			<div className="view-header">
				<CoverArt src={coverUrl(album.cover)} alt={`${album.album} cover`} className="cover-art-view" iconSize={32} />
				<div className="view-header-info">
					<div className="view-title">{album.album}</div>
					<button className="link-btn view-subtitle" onClick={() => onOpenArtist(album.artist)}>
						{album.artist}
					</button>
					{!loading && (
						<div className="view-meta">
							{songs.length} {songs.length === 1 ? "track" : "tracks"} · {formatDuration(totalDuration)}
						</div>
					)}
					<button
						className="icon-btn icon-btn-primary view-play-btn"
						onClick={onPlayAll}
						disabled={songs.length === 0}
						aria-label="Play album"
					>
						<PlayIcon size={15} />
					</button>
				</div>
			</div>

			{loading && <div className="tracklist-empty">Loading…</div>}

			{!loading && (
				<div className="tracklist-rows">
					{songs.map((song, i) => (
						<div
							key={song.id}
							className={`track-row ${song.id === currentSongId ? "active" : ""}`}
							draggable
							onDragStart={(e) => handleDragStart(e, song)}
						>
							<span className="album-track-number">{i + 1}</span>
							<button className="track-row-main" onClick={() => onSelect(i)}>
								<span className="track-title">{song.title}</span>
							</button>
							<span className="track-duration">{formatTime(song.duration)}</span>
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
			)}
		</div>
	);
}
