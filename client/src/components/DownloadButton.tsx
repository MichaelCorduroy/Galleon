import type { MouseEvent } from "react";
import { DownloadIcon } from "../icons";

interface DownloadButtonProps {
	title?: string;
	small?: boolean;
	downloading?: boolean;
	onDownload: () => void;
}

export function DownloadButton({ title = "Download", small, downloading, onDownload }: DownloadButtonProps) {
	const handleClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (!downloading) onDownload();
	};

	return (
		<button
			className={`icon-btn download-btn ${downloading ? "downloading" : ""}`}
			onClick={handleClick}
			aria-label={downloading ? "Downloading…" : title}
			title={downloading ? "Downloading…" : title}
			disabled={downloading}
		>
			<DownloadIcon size={small ? 12 : 13} />
		</button>
	);
}
