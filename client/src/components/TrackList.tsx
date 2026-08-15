import type { DragEvent } from "react";
import type { Song } from "../api";
import { coverUrl } from "../api";
import { CoverArt } from "./CoverArt";
import { LikeButton } from "./LikeButton";
import { PlusIcon } from "../icons";
import { SONG_DRAG_MIME } from "../dnd";
import { formatTime } from "../format";

interface TrackListProps {
	songs: Song[];
	currentSongId?: number;
	onSelect: (index: number) => void;
	onAddToQueue: (song: Song) => void;
	emptyMessage: string;
	likedIds?: Set<number>;
	onToggleLike?: (songId: number) => void;
	onOpenAlbum?: (song: Song) => void;
	onOpenArtist?: (artist: string) => void;
}

export function TrackList({
	songs,
	currentSongId,
	onSelect,
	onAddToQueue,
	emptyMessage,
	likedIds,
	onToggleLike,
	onOpenAlbum,
	onOpenArtist,
}: TrackListProps) {
	const handleDragStart = (e: DragEvent, song: Song) => {
		e.dataTransfer.setData(SONG_DRAG_MIME, JSON.stringify(song));
		e.dataTransfer.effectAllowed = "copy";
	};

	if (songs.length === 0) {
		return <div className="tracklist-empty">{emptyMessage}</div>;
	}

	return (
		<div className="tracklist-rows">
			{songs.map((song, i) => (
				<div
					key={song.id}
					className={`track-row ${song.id === currentSongId ? "active" : ""}`}
					draggable
					onDragStart={(e) => handleDragStart(e, song)}
				>
					<button className="track-row-cover" onClick={() => onSelect(i)} aria-label={`Play ${song.title}`}>
						<CoverArt src={coverUrl(song.cover)} alt={`${song.album} cover`} className="cover-art-sm" iconSize={14} />
					</button>
					<div className="track-row-main">
						{onOpenAlbum ? (
							<button className="track-title-link" onClick={() => onOpenAlbum(song)}>
								{song.title}
							</button>
						) : (
							<button className="track-title-link" onClick={() => onSelect(i)}>
								{song.title}
							</button>
						)}
						{onOpenArtist ? (
							<button className="track-artist track-artist-link" onClick={() => onOpenArtist(song.artist)}>
								{song.artist}
							</button>
						) : (
							<span className="track-artist">{song.artist}</span>
						)}
					</div>
					<span className="track-duration">{formatTime(song.duration)}</span>
					{onToggleLike && (
						<LikeButton liked={likedIds?.has(song.id) ?? false} onToggle={() => onToggleLike(song.id)} small />
					)}
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
	);
}
