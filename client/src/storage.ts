const PREFIX = "galleon:";

export function loadState<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (raw === null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function saveState<T>(key: string, value: T): void {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// storage unavailable (private browsing, quota) — fail silently
	}
}
