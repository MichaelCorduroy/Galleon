import { MoonIcon, SunIcon } from "../icons";

interface ThemeToggleProps {
	theme: "light" | "dark";
	onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
	return (
		<button className="icon-btn theme-toggle" onClick={onToggle} aria-label="Toggle light/dark mode" title="Toggle theme">
			{theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
		</button>
	);
}
