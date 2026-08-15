import { useCallback, useEffect, useRef, useState } from "react";
import { logPlay, type Song, streamUrl } from "./api";
import { loadState, saveState } from "./storage";

const FFT_SIZE = 64;
const RESTART_THRESHOLD = 3; // seconds — prev() restarts the track instead of going back if past this
const HISTORY_LIMIT = 50;
const TIME_SAVE_INTERVAL = 3; // seconds — throttle how often playback position is persisted

// mirrors Last.fm's classic scrobble rule: a track only "counts" as a listen
// once at least half of it (capped at 4 minutes) has actually played, and
// it must be longer than 30s to begin with — short enough to skip through
// doesn't get logged
const MIN_LOGGABLE_DURATION = 30;
const MAX_LISTEN_THRESHOLD = 240;
const SEEK_JUMP_GUARD = 2; // seconds — timeupdate deltas bigger than this are a seek, not real playback

export type RepeatMode = "off" | "all" | "one";

export function useAudioPlayer() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);

	const [currentSong, setCurrentSongState] = useState<Song | undefined>(() =>
		loadState<Song | undefined>("currentSong", undefined),
	);
	const [queue, setQueue] = useState<Song[]>(() => loadState("queue", []));
	const [, setHistory] = useState<Song[]>([]);
	const [autoContext, setAutoContext] = useState<Song[]>(() => loadState("autoContext", []));
	const [autoIndex, setAutoIndex] = useState(() => loadState("autoIndex", -1));
	const [shuffle, setShuffle] = useState(() => loadState("shuffle", false));
	const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => loadState("repeatMode", "off"));

	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolumeState] = useState(() => loadState("volume", 80));

	// refs mirroring state so stable callbacks (used by DOM event listeners
	// registered once) always see the latest values
	const queueRef = useRef(queue);
	const autoContextRef = useRef(autoContext);
	const autoIndexRef = useRef(autoIndex);
	const shuffleRef = useRef(shuffle);
	const repeatModeRef = useRef(repeatMode);
	const currentSongRef = useRef(currentSong);
	const pendingResumeTimeRef = useRef<number | null>(loadState<number | null>("resumeTime", null));
	const lastTimeSaveRef = useRef(0);

	// tracks accumulated real playback time for the current track-play, to
	// decide when it's crossed the "genuine listen" threshold — reset
	// whenever a track starts fresh (new song, restart, or repeat-one loop)
	const playedAccumRef = useRef(0);
	const lastPlayTickRef = useRef(0);
	const loggedRef = useRef(false);
	const resetPlayTracking = () => {
		playedAccumRef.current = 0;
		lastPlayTickRef.current = 0;
		loggedRef.current = false;
	};

	useEffect(() => {
		queueRef.current = queue;
		saveState("queue", queue);
	}, [queue]);
	useEffect(() => {
		autoContextRef.current = autoContext;
		saveState("autoContext", autoContext);
	}, [autoContext]);
	useEffect(() => {
		autoIndexRef.current = autoIndex;
		saveState("autoIndex", autoIndex);
	}, [autoIndex]);
	useEffect(() => {
		shuffleRef.current = shuffle;
		saveState("shuffle", shuffle);
	}, [shuffle]);
	useEffect(() => {
		repeatModeRef.current = repeatMode;
		saveState("repeatMode", repeatMode);
	}, [repeatMode]);
	useEffect(() => {
		currentSongRef.current = currentSong;
		saveState("currentSong", currentSong ?? null);
	}, [currentSong]);
	useEffect(() => {
		saveState("volume", volume);
	}, [volume]);

	const pushHistory = useCallback((song: Song | undefined) => {
		if (!song) return;
		setHistory((h) => [...h.slice(-HISTORY_LIMIT + 1), song]);
	}, []);

	const setCurrentSong = useCallback((song: Song | undefined) => {
		setCurrentSongState(song);
		resetPlayTracking();
		const audio = audioRef.current;
		if (!audio || !song) return;
		audio.src = streamUrl(song.id);
		if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
		audio.play().catch(() => {});
	}, []);

	const pickRandomIndex = useCallback((list: Song[], excludeIndex: number) => {
		if (list.length <= 1) return 0;
		let idx = Math.floor(Math.random() * list.length);
		if (idx === excludeIndex) idx = (idx + 1) % list.length;
		return idx;
	}, []);

	// advance to the next track: manual (next button) or automatic (track ended)
	const advance = useCallback(
		(auto: boolean) => {
			if (auto && repeatModeRef.current === "one") {
				const audio = audioRef.current;
				if (audio) {
					audio.currentTime = 0;
					resetPlayTracking();
					audio.play().catch(() => {});
				}
				return;
			}

			pushHistory(currentSongRef.current);

			if (queueRef.current.length > 0) {
				const [next, ...rest] = queueRef.current;
				setQueue(rest);
				setCurrentSong(next);
				return;
			}

			const context = autoContextRef.current;
			if (context.length === 0) return;

			let newIndex: number;
			if (shuffleRef.current) {
				newIndex = pickRandomIndex(context, autoIndexRef.current);
			} else {
				newIndex = autoIndexRef.current + 1;
				if (newIndex >= context.length) {
					if (repeatModeRef.current === "all") newIndex = 0;
					else return;
				}
			}

			setAutoIndex(newIndex);
			setCurrentSong(context[newIndex]);
		},
		[pushHistory, pickRandomIndex, setCurrentSong],
	);

	useEffect(() => {
		const audio = new Audio();
		audio.crossOrigin = "anonymous";
		audio.volume = volume / 100;
		audioRef.current = audio;

		// restore whatever was playing last session, without autoplaying
		const restoredSong = currentSongRef.current;
		if (restoredSong) {
			audio.src = streamUrl(restoredSong.id);
		}

		const onTimeUpdate = () => {
			const t = audio.currentTime;
			setCurrentTime(t);
			if (t - lastTimeSaveRef.current >= TIME_SAVE_INTERVAL) {
				lastTimeSaveRef.current = t;
				saveState("resumeTime", t);
			}

			// only count forward progress that looks like real playback, not
			// a seek jump, so scrubbing through a track can't fake a listen
			const delta = t - lastPlayTickRef.current;
			lastPlayTickRef.current = t;
			if (delta > 0 && delta < SEEK_JUMP_GUARD) playedAccumRef.current += delta;

			if (!loggedRef.current && audio.duration > MIN_LOGGABLE_DURATION) {
				const threshold = Math.min(audio.duration / 2, MAX_LISTEN_THRESHOLD);
				if (playedAccumRef.current >= threshold) {
					loggedRef.current = true;
					const song = currentSongRef.current;
					if (song) logPlay(song.id, playedAccumRef.current);
				}
			}
		};
		const onLoadedMetadata = () => {
			setDuration(audio.duration || 0);
			if (pendingResumeTimeRef.current !== null) {
				audio.currentTime = pendingResumeTimeRef.current;
				pendingResumeTimeRef.current = null;
			}
		};
		const onEnded = () => advance(true);
		const onPlay = () => setIsPlaying(true);
		const onPause = () => {
			setIsPlaying(false);
			saveState("resumeTime", audio.currentTime);
		};

		audio.addEventListener("timeupdate", onTimeUpdate);
		audio.addEventListener("loadedmetadata", onLoadedMetadata);
		audio.addEventListener("ended", onEnded);
		audio.addEventListener("play", onPlay);
		audio.addEventListener("pause", onPause);

		return () => {
			audio.pause();
			audio.removeEventListener("timeupdate", onTimeUpdate);
			audio.removeEventListener("loadedmetadata", onLoadedMetadata);
			audio.removeEventListener("ended", onEnded);
			audio.removeEventListener("play", onPlay);
			audio.removeEventListener("pause", onPause);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const enableVisualizer = useCallback(() => {
		if (audioCtxRef.current || !audioRef.current) return;
		const ctx = new AudioContext();
		const source = ctx.createMediaElementSource(audioRef.current);
		const analyser = ctx.createAnalyser();
		analyser.fftSize = FFT_SIZE;
		analyser.smoothingTimeConstant = 0.75;
		source.connect(analyser);
		analyser.connect(ctx.destination);
		audioCtxRef.current = ctx;
		analyserRef.current = analyser;
	}, []);

	// plays a track from a browsable list (library / search results), setting
	// that list as the context future next/shuffle calls continue from
	const playFromList = useCallback(
		(list: Song[], index: number) => {
			pushHistory(currentSongRef.current);
			setAutoContext(list);
			setAutoIndex(index);
			setCurrentSong(list[index]);
		},
		[pushHistory, setCurrentSong],
	);

	// plays a track sitting in the manual queue, removing it from the queue;
	// auto-continuation context is left untouched
	const playFromQueue = useCallback(
		(index: number) => {
			const song = queueRef.current[index];
			if (!song) return;
			pushHistory(currentSongRef.current);
			setQueue((q) => q.filter((_, i) => i !== index));
			setCurrentSong(song);
		},
		[pushHistory, setCurrentSong],
	);

	const play = useCallback(() => {
		const audio = audioRef.current;
		audioCtxRef.current?.resume();
		if (!audio) return;
		// if the restored track's initial load failed (e.g. the backend
		// wasn't up yet right after a restart), the element is stuck in an
		// error state and play() alone won't retry the network fetch —
		// reloading the same src first gives it a fresh attempt
		if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
			audio.load();
		}
		audio.play().catch(() => {});
	}, []);

	const pause = useCallback(() => {
		audioRef.current?.pause();
	}, []);

	const togglePlay = useCallback(() => {
		if (isPlaying) pause();
		else play();
	}, [isPlaying, play, pause]);

	const next = useCallback(() => advance(false), [advance]);

	const prev = useCallback(() => {
		const audio = audioRef.current;
		if (audio && audio.currentTime > RESTART_THRESHOLD) {
			audio.currentTime = 0;
			resetPlayTracking();
			return;
		}
		setHistory((h) => {
			if (h.length === 0) {
				if (audio) audio.currentTime = 0;
				return h;
			}
			const prevSong = h[h.length - 1];
			const idx = autoContextRef.current.findIndex((s) => s.id === prevSong.id);
			if (idx !== -1) setAutoIndex(idx);
			setCurrentSong(prevSong);
			return h.slice(0, -1);
		});
	}, [setCurrentSong]);

	const seek = useCallback((time: number) => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = time;
		setCurrentTime(time);
	}, []);

	const setVolume = useCallback((v: number) => {
		setVolumeState(v);
		if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, v / 100));
	}, []);

	const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);

	const cycleRepeatMode = useCallback(() => {
		setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
	}, []);

	const addToQueue = useCallback((song: Song) => {
		setQueue((q) => [...q, song]);
	}, []);

	const removeFromQueue = useCallback((index: number) => {
		setQueue((q) => q.filter((_, i) => i !== index));
	}, []);

	const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
		setQueue((q) => {
			if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= q.length || toIndex >= q.length) {
				return q;
			}
			const next = [...q];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);
			return next;
		});
	}, []);

	const clearQueue = useCallback(() => setQueue([]), []);

	const getFrequencyData = useCallback((out: Uint8Array) => {
		analyserRef.current?.getByteFrequencyData(out as any);
	}, []);

	const upNext = autoContext.slice(autoIndex + 1);

	return {
		currentSong,
		queue,
		upNext,
		autoContext,
		shuffle,
		repeatMode,
		isPlaying,
		currentTime,
		duration,
		volume,
		playFromList,
		playFromQueue,
		play,
		pause,
		togglePlay,
		next,
		prev,
		seek,
		setVolume,
		toggleShuffle,
		cycleRepeatMode,
		addToQueue,
		removeFromQueue,
		reorderQueue,
		clearQueue,
		enableVisualizer,
		getFrequencyData,
		frequencyBinCount: FFT_SIZE / 2,
	};
}
