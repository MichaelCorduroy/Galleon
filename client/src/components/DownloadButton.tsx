import type { MouseEvent } from "react";
import { DownloadIcon } from "../icons";

interface DownloadButtonProps {
	title?: string;
	small?: boolean;
}

// intentionally a no-op for now — just a placeholder affordance for a
// future "fetch this track/album" action
export function DownloadButton({ title = "Download", small }: DownloadButtonProps) {
	const handleClick = (e: MouseEvent) => {
		e.stopPropagation();
	};

	return (
		<button className="icon-btn download-btn" onClick={handleClick} aria-label={title} title={title}>
			<DownloadIcon size={small ? 12 : 13} />
		</button>
	);
}
