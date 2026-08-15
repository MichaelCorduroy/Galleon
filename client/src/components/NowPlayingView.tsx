import type { Song } from "../api";
import { coverUrl } from "../api";
import type { RepeatMode } from "../useAudioPlayer";
import { ChevronLeftIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon } from "../icons";
import { CoverArt } from "./CoverArt";
import { LikeButton } from "./LikeButton";
import { formatTime } from "../format";

interface NowPlayingViewProps {
	currentSong?: Song;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	shuffle: boolean;
	repeatMode: RepeatMode;
	liked: boolean;
	onToggleLike: () => void;
	onOpenAlbum: () => void;
	onBack: () => void;
	onTogglePlay: () => void;
	onNext: () => void;
	onPrev: () => void;
	onSeek: (time: number) => void;
	onToggleShuffle: () => void;
	onCycleRepeat: () => void;
	onOpenArtist: (artist: string) => void;
}

export function NowPlayingView({
	currentSong,
	isPlaying,
	currentTime,
	duration,
	shuffle,
	repeatMode,
	liked,
	onToggleLike,
	onOpenAlbum,
	onBack,
	onTogglePlay,
	onNext,
	onPrev,
	onSeek,
	onToggleShuffle,
	onCycleRepeat,
	onOpenArtist,
}: NowPlayingViewProps) {
	return (
		<div className="now-playing">
			<button className="text-btn back-link" onClick={onBack}>
				<ChevronLeftIcon size={13} />
				Back
			</button>

			<div className="now-playing-stage">
				<CoverArt
					src={coverUrl(currentSong?.cover ?? null)}
					alt={currentSong ? `${currentSong.album} cover` : "No cover"}
					className="cover-art-now-playing"
					iconSize={64}
				/>

				<div className="now-playing-info">
					<div className="now-playing-title-row">
						{currentSong ? (
							<button className="now-playing-title now-playing-title-link" onClick={onOpenAlbum}>
								{currentSong.title}
							</button>
						) : (
							<div className="now-playing-title">Nothing playing</div>
						)}
						{currentSong && <LikeButton liked={liked} onToggle={onToggleLike} />}
					</div>
					{currentSong ? (
						<button className="link-btn now-playing-artist" onClick={() => onOpenArtist(currentSong.artist)}>
							{currentSong.artist}
						</button>
					) : (
						<div className="view-meta">Search or pick a track to begin</div>
					)}
				</div>

				<div className="player-progress now-playing-progress">
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

				<div className="player-controls now-playing-controls">
					<button
						className={`icon-btn ${shuffle ? "active" : ""}`}
						onClick={onToggleShuffle}
						aria-label="Toggle shuffle"
						title="Shuffle"
					>
						<ShuffleIcon size={16} />
					</button>
					<button className="icon-btn" onClick={onPrev} aria-label="Previous" disabled={!currentSong}>
						<PrevIcon size={20} />
					</button>
					<button
						className="icon-btn icon-btn-primary now-playing-play-btn"
						onClick={onTogglePlay}
						aria-label="Play/Pause"
						disabled={!currentSong}
					>
						{isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
					</button>
					<button className="icon-btn" onClick={onNext} aria-label="Next" disabled={!currentSong}>
						<NextIcon size={20} />
					</button>
					<button
						className={`icon-btn ${repeatMode !== "off" ? "active" : ""}`}
						onClick={onCycleRepeat}
						aria-label="Cycle repeat mode"
						title={`Repeat: ${repeatMode}`}
					>
						{repeatMode === "one" ? <RepeatOneIcon size={16} /> : <RepeatIcon size={16} />}
					</button>
				</div>
			</div>
		</div>
	);
}
