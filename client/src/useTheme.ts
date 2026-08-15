import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "galleon-theme";

function getInitialTheme(): Theme {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem(STORAGE_KEY, theme);
	}, [theme]);

	const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

	return { theme, toggleTheme };
}
