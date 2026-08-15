import { useState } from "react";
import type { Song } from "../api";
import { coverUrl } from "../api";
import type { RepeatMode } from "../useAudioPlayer";
import {
	EqualizerIcon,
	NextIcon,
	PauseIcon,
	PlayIcon,
	PrevIcon,
	QueueIcon,
	RepeatIcon,
	RepeatOneIcon,
	ShuffleIcon,
	VolumeIcon,
} from "../icons";
import { CoverArt } from "./CoverArt";
import { LikeButton } from "./LikeButton";
import { Visualizer } from "./Visualizer";
import { formatTime } from "../format";

interface BigPlayerProps {
	currentSong?: Song;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	shuffle: boolean;
	repeatMode: RepeatMode;
	showQueue: boolean;
	liked: boolean;
	onToggleLike: () => void;
	onTogglePlay: () => void;
	onNext: () => void;
	onPrev: () => void;
	onSeek: (time: number) => void;
	onVolumeChange: (v: number) => void;
	onToggleShuffle: () => void;
	onCycleRepeat: () => void;
	onToggleQueue: () => void;
	onOpenAlbum: () => void;
	onOpenArtist: (artist: string) => void;
	onOpenNowPlaying: () => void;
	onEnableVisualizer: () => void;
	getFrequencyData: (out: Uint8Array) => void;
	frequencyBinCount: number;
}

export function BigPlayer({
	currentSong,
	isPlaying,
	currentTime,
	duration,
	volume,
	shuffle,
	repeatMode,
	showQueue,
	liked,
	onToggleLike,
	onTogglePlay,
	onNext,
	onPrev,
	onSeek,
	onVolumeChange,
	onToggleShuffle,
	onCycleRepeat,
	onToggleQueue,
	onOpenAlbum,
	onOpenArtist,
	onOpenNowPlaying,
	onEnableVisualizer,
	getFrequencyData,
	frequencyBinCount,
}: BigPlayerProps) {
	const [showVisualizer, setShowVisualizer] = useState(false);

	const toggleVisualizer = () => {
		if (!showVisualizer) onEnableVisualizer();
		setShowVisualizer((v) => !v);
	};

	return (
		<div className="big-player">
			<button className="cover-art-btn" onClick={onOpenNowPlaying} aria-label="Open now playing view">
				<CoverArt
					src={coverUrl(currentSong?.cover ?? null)}
					alt={currentSong ? `${currentSong.album} cover` : "No cover"}
					className="cover-art-xl"
					iconSize={40}
				/>
			</button>

			<div className="big-player-info">
				<div className="big-player-title-row">
					{currentSong ? (
						<button className="big-player-title big-player-title-link" onClick={onOpenAlbum}>
							{currentSong.title}
						</button>
					) : (
						<div className="big-player-title">Nothing playing</div>
					)}
					{currentSong && <LikeButton liked={liked} onToggle={onToggleLike} small />}
				</div>
				{currentSong ? (
					<button className="link-btn big-player-artist" onClick={() => onOpenArtist(currentSong.artist)}>
						{currentSong.artist}
					</button>
				) : (
					<div className="big-player-artist-placeholder">Search or pick a track to begin</div>
				)}
			</div>

			<div className="player-progress">
				<span className="player-time">{formatTime(currentTime)}</span>
				<input
					className="seekbar"
					type="range"
					min={0}
					max={duration || 0}
					step={0.1}
					value={Math.min(currentTime, duration || 0)}
					onChange={(e) => onSeek(Number(e.target.value))}
					disabled={!currentSong}
				/>
				<span className="player-time">{formatTime(duration)}</span>
			</div>

			<div className="player-controls">
				<button
					className={`icon-btn ${shuffle ? "active" : ""}`}
					onClick={onToggleShuffle}
					aria-label="Toggle shuffle"
					title="Shuffle"
				>
					<ShuffleIcon size={14} />
				</button>
				<button className="icon-btn" onClick={onPrev} aria-label="Previous" disabled={!currentSong}>
					<PrevIcon />
				</button>
				<button
					className="icon-btn icon-btn-primary"
					onClick={onTogglePlay}
					aria-label="Play/Pause"
					disabled={!currentSong}
				>
					{isPlaying ? <PauseIcon /> : <PlayIcon />}
				</button>
				<button className="icon-btn" onClick={onNext} aria-label="Next" disabled={!currentSong}>
					<NextIcon />
				</button>
				<button
					className={`icon-btn ${repeatMode !== "off" ? "active" : ""}`}
					onClick={onCycleRepeat}
					aria-label="Cycle repeat mode"
					title={`Repeat: ${repeatMode}`}
				>
					{repeatMode === "one" ? <RepeatOneIcon size={14} /> : <RepeatIcon size={14} />}
				</button>
			</div>

			<div className="player-controls player-controls-secondary">
				<button
					className={`icon-btn visualizer-toggle ${showVisualizer ? "active" : ""}`}
					onClick={toggleVisualizer}
					aria-label="Toggle visualizer"
					title="Toggle visualizer"
				>
					<EqualizerIcon size={14} />
				</button>
				<button
					className={`icon-btn ${showQueue ? "active" : ""}`}
					onClick={onToggleQueue}
					aria-label="Toggle queue panel"
					title="Queue"
				>
					<QueueIcon size={14} />
				</button>

				<div className="volume">
					<VolumeIcon size={14} />
					<input
						type="range"
						min={0}
						max={100}
						value={volume}
						onChange={(e) => onVolumeChange(Number(e.target.value))}
					/>
				</div>
			</div>

			{showVisualizer && (
				<Visualizer getFrequencyData={getFrequencyData} binCount={frequencyBinCount} isPlaying={isPlaying} />
			)}
		</div>
	);
}
