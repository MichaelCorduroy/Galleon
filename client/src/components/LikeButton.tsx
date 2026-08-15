import { HeartIcon } from "../icons";

interface LikeButtonProps {
	liked: boolean;
	onToggle: () => void;
	small?: boolean;
}

export function LikeButton({ liked, onToggle, small }: LikeButtonProps) {
	return (
		<button
			className={`icon-btn like-btn ${liked ? "liked" : ""}`}
			onClick={(e) => {
				e.stopPropagation();
				onToggle();
			}}
			aria-label={liked ? "Unlike" : "Like"}
			title={liked ? "Unlike" : "Like"}
		>
			<HeartIcon size={small ? 13 : 15} filled={liked} />
		</button>
	);
}
