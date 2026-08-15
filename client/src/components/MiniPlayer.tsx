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
import { Visualizer } from "./Visualizer";
import { formatTime } from "../format";

interface MiniPlayerProps {
	currentSong?: Song;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	shuffle: boolean;
	repeatMode: RepeatMode;
	showQueue: boolean;
	onTogglePlay: () => void;
	onNext: () => void;
	onPrev: () => void;
	onSeek: (time: number) => void;
	onVolumeChange: (v: number) => void;
	onToggleShuffle: () => void;
	onCycleRepeat: () => void;
	onToggleQueue: () => void;
	onEnableVisualizer: () => void;
	getFrequencyData: (out: Uint8Array) => void;
	frequencyBinCount: number;
}

export function MiniPlayer({
	currentSong,
	isPlaying,
	currentTime,
	duration,
	volume,
	shuffle,
	repeatMode,
	showQueue,
	onTogglePlay,
	onNext,
	onPrev,
	onSeek,
	onVolumeChange,
	onToggleShuffle,
	onCycleRepeat,
	onToggleQueue,
	onEnableVisualizer,
	getFrequencyData,
	frequencyBinCount,
}: MiniPlayerProps) {
	const [showVisualizer, setShowVisualizer] = useState(false);

	const toggleVisualizer = () => {
		if (!showVisualizer) onEnableVisualizer();
		setShowVisualizer((v) => !v);
	};

	return (
		<div className="mini-player">
			{showVisualizer && (
				<Visualizer getFrequencyData={getFrequencyData} binCount={frequencyBinCount} isPlaying={isPlaying} />
			)}

			<input
				className="mini-seekbar"
				type="range"
				min={0}
				max={duration || 0}
				step={0.1}
				value={Math.min(currentTime, duration || 0)}
				onChange={(e) => onSeek(Number(e.target.value))}
				disabled={!currentSong}
			/>

			<div className="mini-player-row">
				<div className="mini-player-track">
					<CoverArt
						src={coverUrl(currentSong?.cover ?? null)}
						alt={currentSong ? `${currentSong.album} cover` : "No cover"}
						className="cover-art-sm"
						iconSize={14}
					/>
					<div className="mini-player-info">
						<span className="mini-player-title">{currentSong ? currentSong.title : "Nothing playing"}</span>
						<span className="mini-player-artist">
							{currentSong
								? `${currentSong.artist} · ${formatTime(currentTime)} / ${formatTime(duration)}`
								: "Search or pick a track to begin"}
						</span>
					</div>
				</div>

				<div className="mini-player-controls">
					<button
						className={`icon-btn ${shuffle ? "active" : ""}`}
						onClick={onToggleShuffle}
						aria-label="Toggle shuffle"
						title="Shuffle"
					>
						<ShuffleIcon size={13} />
					</button>
					<button className="icon-btn" onClick={onPrev} aria-label="Previous" disabled={!currentSong}>
						<PrevIcon size={14} />
					</button>
					<button
						className="icon-btn icon-btn-primary"
						onClick={onTogglePlay}
						aria-label="Play/Pause"
						disabled={!currentSong}
					>
						{isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
					</button>
					<button className="icon-btn" onClick={onNext} aria-label="Next" disabled={!currentSong}>
						<NextIcon size={14} />
					</button>
					<button
						className={`icon-btn ${repeatMode !== "off" ? "active" : ""}`}
						onClick={onCycleRepeat}
						aria-label="Cycle repeat mode"
						title={`Repeat: ${repeatMode}`}
					>
						{repeatMode === "one" ? <RepeatOneIcon size={13} /> : <RepeatIcon size={13} />}
					</button>
				</div>

				<div className="mini-player-extra">
					<button
						className={`icon-btn visualizer-toggle ${showVisualizer ? "active" : ""}`}
						onClick={toggleVisualizer}
						aria-label="Toggle visualizer"
						title="Toggle visualizer"
					>
						<EqualizerIcon size={13} />
					</button>
					<button
						className={`icon-btn ${showQueue ? "active" : ""}`}
						onClick={onToggleQueue}
						aria-label="Toggle queue panel"
						title="Queue"
					>
						<QueueIcon size={13} />
					</button>
					<div className="volume">
						<VolumeIcon size={13} />
						<input
							type="range"
							min={0}
							max={100}
							value={volume}
							onChange={(e) => onVolumeChange(Number(e.target.value))}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
