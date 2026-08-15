import { useEffect, useRef, useState } from "react";
import { fetchDownloadJobs, type DownloadJob } from "../api";
import { DownloadIcon } from "../icons";

const POLL_MS = 2000;

export function DownloadsIndicator() {
	const [jobs, setJobs] = useState<DownloadJob[]>([]);
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;
		const tick = () => {
			fetchDownloadJobs().then((next) => {
				if (!cancelled) setJobs(next);
			});
		};
		tick();
		const timer = setInterval(tick, POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, []);

	useEffect(() => {
		if (!open) return;
		const onClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, [open]);

	const activeCount = jobs.filter((j) => j.status === "pending" || j.status === "downloading").length;

	// nothing active and nothing recent enough to be worth a glance —
	// stay out of the header entirely
	if (activeCount === 0 && jobs.length === 0) return null;

	return (
		<div className="downloads-indicator" ref={containerRef}>
			<button
				className={`downloads-indicator-btn ${activeCount > 0 ? "active" : ""}`}
				onClick={() => setOpen((v) => !v)}
				aria-label="Downloads"
				title="Downloads"
			>
				<DownloadIcon size={15} />
				{activeCount > 0 && <span className="downloads-indicator-badge">{activeCount}</span>}
			</button>

			{open && (
				<div className="downloads-panel">
					<div className="downloads-panel-title">Downloads</div>
					{jobs.length === 0 && <div className="downloads-panel-empty">No downloads yet.</div>}
					<div className="downloads-panel-list">
						{jobs.map((job) => (
							<div key={job.id} className={`downloads-panel-row status-${job.status}`}>
								<span className="downloads-panel-status" aria-hidden>
									{job.status === "success" && "✓"}
									{job.status === "failed" && "✕"}
									{(job.status === "pending" || job.status === "downloading") && "…"}
								</span>
								<div className="downloads-panel-info">
									<span className="downloads-panel-track-title">{job.title}</span>
									<span className="downloads-panel-track-meta">
										{job.artist} · {job.album}
									</span>
									{job.status === "failed" && job.error && (
										<span className="downloads-panel-error">{job.error}</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
