import { useState, type DragEvent } from "react";
import type { Song } from "../api";
import { coverUrl } from "../api";
import { CloseIcon, GripIcon } from "../icons";
import { CoverArt } from "./CoverArt";
import { SONG_DRAG_MIME } from "../dnd";
import { formatTime } from "../format";

const QUEUE_INDEX_MIME = "application/x-galleon-queue-index";

interface QueueProps {
	queue: Song[];
	upNext: Song[];
	shuffle: boolean;
	onPlay: (index: number) => void;
	onRemove: (index: number) => void;
	onReorder: (from: number, to: number) => void;
	onAdd: (song: Song) => void;
	onClear: () => void;
}

export function Queue({ queue, upNext, shuffle, onPlay, onRemove, onReorder, onAdd, onClear }: QueueProps) {
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [containerDragOver, setContainerDragOver] = useState(false);

	const handleContainerDrop = (e: DragEvent) => {
		e.preventDefault();
		setContainerDragOver(false);
		setDragOverIndex(null);
		const songJson = e.dataTransfer.getData(SONG_DRAG_MIME);
		if (songJson) {
			try {
				onAdd(JSON.parse(songJson) as Song);
			} catch {
				// ignore malformed drag payload
			}
		}
	};

	const handleRowDragStart = (e: DragEvent, index: number) => {
		e.dataTransfer.setData(QUEUE_INDEX_MIME, String(index));
		e.dataTransfer.effectAllowed = "move";
	};

	const handleRowDrop = (e: DragEvent, index: number) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOverIndex(null);
		setContainerDragOver(false);

		const queueIndex = e.dataTransfer.getData(QUEUE_INDEX_MIME);
		if (queueIndex !== "") {
			onReorder(Number(queueIndex), index);
			return;
		}
		const songJson = e.dataTransfer.getData(SONG_DRAG_MIME);
		if (songJson) {
			try {
				onAdd(JSON.parse(songJson) as Song);
			} catch {
				// ignore malformed drag payload
			}
		}
	};

	return (
		<div className="queue-panel">
			<div className="panel-header">
				<span>Queue</span>
				{queue.length > 0 && (
					<button className="text-btn" onClick={onClear}>
						Clear
					</button>
				)}
			</div>

			<div
				className={`queue-list ${containerDragOver ? "drag-over" : ""}`}
				onDragOver={(e) => {
					e.preventDefault();
					setContainerDragOver(true);
				}}
				onDragLeave={() => setContainerDragOver(false)}
				onDrop={handleContainerDrop}
			>
				{queue.length === 0 && (
					<div className="queue-empty">Drag tracks here, or use the + button on any track.</div>
				)}

				{queue.map((song, i) => (
					<div
						key={`${song.id}-${i}`}
						className={`queue-row ${dragOverIndex === i ? "drag-target" : ""}`}
						draggable
						onDragStart={(e) => handleRowDragStart(e, i)}
						onDragOver={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setDragOverIndex(i);
						}}
						onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
						onDrop={(e) => handleRowDrop(e, i)}
					>
						<span className="queue-grip">
							<GripIcon size={12} />
						</span>
						<CoverArt src={coverUrl(song.cover)} alt={`${song.album} cover`} className="cover-art-sm" iconSize={12} />
						<button className="queue-row-main" onClick={() => onPlay(i)}>
							<span className="track-title">{song.title}</span>
							<span className="track-artist">{song.artist}</span>
						</button>
						<span className="track-duration">{formatTime(song.duration)}</span>
						<button className="icon-btn queue-remove" onClick={() => onRemove(i)} aria-label="Remove from queue">
							<CloseIcon size={12} />
						</button>
					</div>
				))}
			</div>

			{!shuffle && upNext.length > 0 && (
				<>
					<div className="panel-header panel-header-secondary">
						<span>Up next</span>
					</div>
					<div className="queue-list queue-list-preview">
						{upNext.slice(0, 8).map((song, i) => (
							<div key={`${song.id}-${i}`} className="queue-row queue-row-preview">
								<CoverArt src={coverUrl(song.cover)} alt={`${song.album} cover`} className="cover-art-sm" iconSize={12} />
								<span className="queue-row-main">
									<span className="track-title">{song.title}</span>
									<span className="track-artist">{song.artist}</span>
								</span>
								<span className="track-duration">{formatTime(song.duration)}</span>
							</div>
						))}
					</div>
				</>
			)}

			{shuffle && (
				<div className="queue-shuffle-note">Shuffling from your current list.</div>
			)}
		</div>
	);
}
