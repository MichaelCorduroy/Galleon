import { useState } from "react";
import { MusicNoteIcon } from "../icons";

interface CoverArtProps {
	src?: string;
	alt: string;
	className?: string;
	iconSize?: number;
}

export function CoverArt({ src, alt, className, iconSize = 16 }: CoverArtProps) {
	const [failed, setFailed] = useState(false);

	if (!src || failed) {
		return (
			<div className={`cover-art cover-art-placeholder ${className ?? ""}`}>
				<MusicNoteIcon size={iconSize} />
			</div>
		);
	}

	return (
		<img
			src={src}
			alt={alt}
			className={`cover-art ${className ?? ""}`}
			onError={() => setFailed(true)}
		/>
	);
}
