type IconProps = { size?: number };

export function PlayIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<path d="M4 2.5v11l9-5.5-9-5.5z" />
		</svg>
	);
}

export function PauseIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<rect x="3.5" y="2.5" width="3" height="11" />
			<rect x="9.5" y="2.5" width="3" height="11" />
		</svg>
	);
}

export function PrevIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<rect x="2.5" y="2.5" width="1.8" height="11" />
			<path d="M13 2.5v11L4.5 8 13 2.5z" />
		</svg>
	);
}

export function NextIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<rect x="11.7" y="2.5" width="1.8" height="11" />
			<path d="M3 2.5v11L11.5 8 3 2.5z" />
		</svg>
	);
}

export function VolumeIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
			<path d="M1.5 6h2.5l3.5-3v10l-3.5-3H1.5z" fill="currentColor" stroke="none" />
			<path d="M10.5 5.5a3 3 0 0 1 0 5" strokeLinecap="round" />
			<path d="M12.3 3.7a6 6 0 0 1 0 8.6" strokeLinecap="round" />
		</svg>
	);
}

export function SearchIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
			<circle cx="7" cy="7" r="5" />
			<path d="M11 11l3.5 3.5" strokeLinecap="round" />
		</svg>
	);
}

export function CloseIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
			<path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
		</svg>
	);
}

export function SunIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
			<circle cx="8" cy="8" r="3.2" />
			<g strokeLinecap="round">
				<path d="M8 1v1.6" />
				<path d="M8 13.4V15" />
				<path d="M1 8h1.6" />
				<path d="M13.4 8H15" />
				<path d="M3.1 3.1l1.2 1.2" />
				<path d="M11.7 11.7l1.2 1.2" />
				<path d="M12.9 3.1l-1.2 1.2" />
				<path d="M4.3 11.7l-1.2 1.2" />
			</g>
		</svg>
	);
}

export function MoonIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" />
		</svg>
	);
}

export function EqualizerIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<rect x="1.5" y="7" width="2.4" height="7" rx="1" />
			<rect x="6.8" y="3" width="2.4" height="11" rx="1" />
			<rect x="12.1" y="9" width="2.4" height="5" rx="1" />
		</svg>
	);
}

export function MusicNoteIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<path d="M11.5 2v7.2a2.6 2.6 0 1 0 1.2 2.2V4.4L6.3 6V11a2.6 2.6 0 1 0 1.2 2.2V3.6L11.5 2z" />
		</svg>
	);
}

export function ShuffleIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
			<path d="M1.5 4h2.3c1 0 1.9.5 2.5 1.4l4.4 5.2c.6.9 1.5 1.4 2.5 1.4h1.3" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M1.5 12h2.3c1 0 1.9-.5 2.5-1.4l.5-.6" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M9.3 5.4l.7-.9c.6-.9 1.5-1.4 2.5-1.4h1.9" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M12.8 1.5L14.5 3l-1.7 1.5" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M12.8 14.5L14.5 13l-1.7-1.5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function RepeatIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
			<path d="M3 5.5h8a2 2 0 0 1 2 2V9" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M13 10.5H5a2 2 0 0 1-2-2V7" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M4.8 3.3L3 5.5l1.8 2.2" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M11.2 12.7L13 10.5l-1.8-2.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function RepeatOneIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
			<path d="M3 5.5h8a2 2 0 0 1 2 2V9" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M13 10.5H5a2 2 0 0 1-2-2V7" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M4.8 3.3L3 5.5l1.8 2.2" strokeLinecap="round" strokeLinejoin="round" />
			<path d="M11.2 12.7L13 10.5l-1.8-2.2" strokeLinecap="round" strokeLinejoin="round" />
			<text x="8" y="8.6" fontSize="5.5" fontWeight="700" textAnchor="middle" stroke="none" fill="currentColor">
				1
			</text>
		</svg>
	);
}

export function QueueIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
			<path d="M1.5 3.5h9" strokeLinecap="round" />
			<path d="M1.5 7h9" strokeLinecap="round" />
			<path d="M1.5 10.5h5.5" strokeLinecap="round" />
			<path d="M11.5 6.5v7M8.5 10h6" strokeLinecap="round" />
		</svg>
	);
}

export function PlusIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
			<path d="M8 3v10M3 8h10" strokeLinecap="round" />
		</svg>
	);
}

export function ChevronLeftIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
			<path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function GripIcon({ size = 16 }: IconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<circle cx="5.5" cy="4" r="1.1" />
			<circle cx="5.5" cy="8" r="1.1" />
			<circle cx="5.5" cy="12" r="1.1" />
			<circle cx="10.5" cy="4" r="1.1" />
			<circle cx="10.5" cy="8" r="1.1" />
			<circle cx="10.5" cy="12" r="1.1" />
		</svg>
	);
}
