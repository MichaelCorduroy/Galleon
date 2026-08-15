import { CloseIcon, SearchIcon } from "../icons";

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
	return (
		<div className="search-bar">
			<SearchIcon size={14} />
			<input
				type="text"
				placeholder="Search titles, artists, albums…"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			{value && (
				<button className="search-clear" onClick={() => onChange("")} aria-label="Clear search">
					<CloseIcon size={12} />
				</button>
			)}
		</div>
	);
}
