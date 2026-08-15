import type { DragEvent } from "react";
import type { Song } from "../api";
import { coverUrl } from "../api";
import { CoverArt } from "./CoverArt";
import { PlusIcon } from "../icons";
import { SONG_DRAG_MIME } from "../dnd";
import { formatTime } from "../format";

interface TrackListProps {
	songs: Song[];
	currentSongId?: number;
	onSelect: (index: number) => void;
	onAddToQueue: (song: Song) => void;
	emptyMessage: string;
}

export function TrackList({ songs, currentSongId, onSelect, onAddToQueue, emptyMessage }: TrackListProps) {
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
					<CoverArt src={coverUrl(song.cover)} alt={`${song.album} cover`} className="cover-art-sm" iconSize={14} />
					<button className="track-row-main" onClick={() => onSelect(i)}>
						<span className="track-title">{song.title}</span>
						<span className="track-artist">{song.artist}</span>
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
	);
}
