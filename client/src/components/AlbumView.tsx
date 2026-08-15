import type { DragEvent } from "react";
import type { Album, TracklistTrack } from "../api";
import { coverUrl } from "../api";
import { CoverArt } from "./CoverArt";
import { DownloadButton } from "./DownloadButton";
import { ChevronLeftIcon, PlayIcon, PlusIcon } from "../icons";
import { SONG_DRAG_MIME } from "../dnd";
import { formatDuration, formatTime } from "../format";

interface AlbumViewProps {
	album: Album;
	tracks: TracklistTrack[];
	loading: boolean;
	currentSongId?: number;
	onBack: () => void;
	onPlayAll: () => void;
	onSelect: (songId: number) => void;
	onAddToQueue: (songId: number) => void;
	onOpenArtist: (artist: string) => void;
}

export function AlbumView({
	album,
	tracks,
	loading,
	currentSongId,
	onBack,
	onPlayAll,
	onSelect,
	onAddToQueue,
	onOpenArtist,
}: AlbumViewProps) {
	const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
	const ownedCount = tracks.filter((t) => t.owned).length;
	const missingCount = tracks.length - ownedCount;

	const handleDragStart = (e: DragEvent, songId: number) => {
		e.dataTransfer.setData(SONG_DRAG_MIME, JSON.stringify({ id: songId }));
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
							{tracks.length} {tracks.length === 1 ? "track" : "tracks"} · {formatDuration(totalDuration)}
							{missingCount > 0 && ` · ${missingCount} missing`}
						</div>
					)}
					<div className="view-header-actions">
						<button
							className="icon-btn icon-btn-primary view-play-btn"
							onClick={onPlayAll}
							disabled={ownedCount === 0}
							aria-label="Play album"
						>
							<PlayIcon size={15} />
						</button>
						{missingCount > 0 && <DownloadButton title={`Download ${missingCount} missing tracks`} />}
					</div>
				</div>
			</div>

			{loading && <div className="tracklist-empty">Loading…</div>}

			{!loading && (
				<div className="tracklist-rows">
					{tracks.map((track) => (
						<div
							key={track.position}
							className={`track-row ${track.owned ? "" : "track-row-missing"} ${
								track.owned && track.songId === currentSongId ? "active" : ""
							}`}
							draggable={track.owned}
							onDragStart={track.owned && track.songId ? (e) => handleDragStart(e, track.songId!) : undefined}
						>
							<span className="album-track-number">{track.position}</span>
							{track.owned && track.songId ? (
								<button className="track-row-main" onClick={() => onSelect(track.songId!)}>
									<span className="track-title">{track.title}</span>
								</button>
							) : (
								<span className="track-row-main track-row-main-static">
									<span className="track-title">{track.title}</span>
								</span>
							)}
							<span className="track-duration">{formatTime(track.duration ?? 0)}</span>
							{track.owned && track.songId ? (
								<button
									className="icon-btn track-add-btn"
									onClick={() => onAddToQueue(track.songId!)}
									aria-label="Add to queue"
									title="Add to queue"
								>
									<PlusIcon size={13} />
								</button>
							) : (
								<DownloadButton title={`Download "${track.title}"`} small />
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
