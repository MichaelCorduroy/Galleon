import { useEffect, useState } from "react";
import type { HistoryStats, PlayHistoryEntry } from "../api";
import { fetchHistory, fetchHistoryStats } from "../api";
import { ChevronLeftIcon } from "../icons";
import { formatListeningTime, formatRelativeTime, formatTime } from "../format";

interface HistoryViewProps {
	onBack: () => void;
	onOpenArtist: (artist: string) => void;
}

const STATS_WINDOW_DAYS = 30;
const RECENT_LIMIT = 100;

export function HistoryView({ onBack, onOpenArtist }: HistoryViewProps) {
	const [stats, setStats] = useState<HistoryStats | null>(null);
	const [recent, setRecent] = useState<PlayHistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		Promise.all([fetchHistoryStats(STATS_WINDOW_DAYS), fetchHistory(RECENT_LIMIT)]).then(([s, r]) => {
			if (cancelled) return;
			setStats(s);
			setRecent(r);
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="content-view">
			<button className="text-btn back-link" onClick={onBack}>
				<ChevronLeftIcon size={13} />
				Back
			</button>

			<div className="view-title">Listening History</div>
			{stats && (
				<div className="view-meta view-meta-spaced">
					{stats.totalPlays} {stats.totalPlays === 1 ? "play" : "plays"} · {formatListeningTime(stats.totalSeconds)}{" "}
					in the last {STATS_WINDOW_DAYS} days
				</div>
			)}

			{loading && <div className="tracklist-empty">Loading…</div>}

			{!loading && stats && stats.totalPlays === 0 && recent.length === 0 && (
				<div className="search-empty">
					No listening history yet. Play something for a while and it'll start showing up here.
				</div>
			)}

			{stats && (stats.topArtists.length > 0 || stats.topSongs.length > 0) && (
				<div className="history-stats-row">
					{stats.topArtists.length > 0 && (
						<div className="search-section history-stats-col">
							<div className="search-section-title">Top artists · {STATS_WINDOW_DAYS}d</div>
							<div className="history-rank-list">
								{stats.topArtists.map((a, i) => (
									<button key={a.artist} className="history-rank-row" onClick={() => onOpenArtist(a.artist)}>
										<span className="history-rank-num">{i + 1}</span>
										<span className="history-rank-name">{a.artist}</span>
										<span className="history-rank-count">{a.plays}</span>
									</button>
								))}
							</div>
						</div>
					)}

					{stats.topSongs.length > 0 && (
						<div className="search-section history-stats-col">
							<div className="search-section-title">Top songs · {STATS_WINDOW_DAYS}d</div>
							<div className="history-rank-list">
								{stats.topSongs.map((s, i) => (
									<div key={`${s.artist}::${s.title}`} className="history-rank-row history-rank-row-static">
										<span className="history-rank-num">{i + 1}</span>
										<span className="history-rank-name">
											{s.title}
											<span className="history-rank-sub"> · {s.artist}</span>
										</span>
										<span className="history-rank-count">{s.plays}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{recent.length > 0 && (
				<div className="search-section">
					<div className="search-section-title">Recent plays</div>
					<div className="tracklist-rows">
						{recent.map((entry) => (
							<div key={entry.id} className="track-row history-row">
								<button className="track-row-main" onClick={() => onOpenArtist(entry.artist)}>
									<span className="track-title">{entry.title}</span>
									<span className="track-artist">
										{entry.artist} · {entry.album}
									</span>
								</button>
								<span className="history-row-duration">
									{formatTime(entry.playedSeconds)}
									{entry.trackDuration ? ` / ${formatTime(entry.trackDuration)}` : ""}
								</span>
								<span className="history-row-time">{formatRelativeTime(entry.playedAt)}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
