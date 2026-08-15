import { useEffect, useMemo, useState } from "react";
import { fetchAlbums, fetchSongs, fetchTracklist, scanLibrary, withRetry, type Album, type Song, type Tracklist } from "./api";
import { useAudioPlayer } from "./useAudioPlayer";
import { useTheme } from "./useTheme";
import { deriveArtists } from "./artists";
import { BigPlayer } from "./components/BigPlayer";
import { MiniPlayer } from "./components/MiniPlayer";
import { TrackList } from "./components/TrackList";
import { AlbumGrid } from "./components/AlbumGrid";
import { AlbumView } from "./components/AlbumView";
import { ArtistGrid } from "./components/ArtistGrid";
import { ArtistView } from "./components/ArtistView";
import { NowPlayingView } from "./components/NowPlayingView";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { ThemeToggle } from "./components/ThemeToggle";
import { Queue } from "./components/Queue";
import "./player.css";

type LibraryView = "songs" | "albums" | "artists";

function App() {
	const player = useAudioPlayer();
	const { theme, toggleTheme } = useTheme();
	const [library, setLibrary] = useState<Song[]>([]);
	const [albums, setAlbums] = useState<Album[]>([]);
	const [scanning, setScanning] = useState(false);
	const [query, setQuery] = useState("");
	const [showQueue, setShowQueue] = useState(false);
	const [libraryView, setLibraryView] = useState<LibraryView>("songs");

	const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
	const [tracklist, setTracklist] = useState<Tracklist | null>(null);
	const [albumSongsLoading, setAlbumSongsLoading] = useState(false);
	const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
	const [nowPlayingOpen, setNowPlayingOpen] = useState(false);

	useEffect(() => {
		withRetry(fetchSongs).then(setLibrary).catch(() => {});
		withRetry(fetchAlbums).then(setAlbums).catch(() => {});
	}, []);

	const artists = useMemo(() => deriveArtists(albums), [albums]);

	const rescan = async () => {
		setScanning(true);
		try {
			const songs: Song[] = await scanLibrary();
			setLibrary(songs.length ? songs : await fetchSongs());
			setAlbums(await fetchAlbums());
		} finally {
			setScanning(false);
		}
	};

	// the main content area is a single slot: search, now-playing, album,
	// artist and the plain library tabs are mutually exclusive — starting a
	// search drops whatever else was open, and opening any of the others
	// clears the search box, so there's never ambiguity about what's showing
	const handleQueryChange = (next: string) => {
		setQuery(next);
		if (next.trim()) {
			setSelectedAlbum(null);
			setSelectedArtist(null);
			setNowPlayingOpen(false);
		}
	};

	const openAlbum = (album: Album) => {
		setQuery("");
		setSelectedArtist(null);
		setNowPlayingOpen(false);
		setSelectedAlbum(album);
		setAlbumSongsLoading(true);
		fetchTracklist(album.album, album.artist)
			.then(setTracklist)
			.finally(() => setAlbumSongsLoading(false));
	};

	const openArtist = (artist: string) => {
		setQuery("");
		setSelectedAlbum(null);
		setNowPlayingOpen(false);
		setSelectedArtist(artist);
	};

	const openNowPlaying = () => {
		setQuery("");
		setSelectedAlbum(null);
		setSelectedArtist(null);
		setNowPlayingOpen(true);
	};

	const backToLibrary = () => {
		setSelectedAlbum(null);
		setSelectedArtist(null);
		setNowPlayingOpen(false);
	};

	const artistAlbums = useMemo(
		() => (selectedArtist ? albums.filter((a) => a.artist === selectedArtist) : []),
		[albums, selectedArtist],
	);

	const librarySongsById = useMemo(() => new Map(library.map((s) => [s.id, s])), [library]);

	// the tracklist from the backend includes gaps for tracks we don't own —
	// playback only ever walks the owned subset, in canonical album order
	const albumOwnedSongs = useMemo(() => {
		if (!tracklist) return [];
		return tracklist.tracks
			.filter((t) => t.owned && t.songId !== null)
			.map((t) => librarySongsById.get(t.songId as number))
			.filter((s): s is Song => Boolean(s));
	}, [tracklist, librarySongsById]);

	const playTracklistSong = (songId: number) => {
		const index = albumOwnedSongs.findIndex((s) => s.id === songId);
		if (index !== -1) player.playFromList(albumOwnedSongs, index);
	};

	const playAlbumFromStart = () => {
		if (albumOwnedSongs.length > 0) player.playFromList(albumOwnedSongs, 0);
	};

	const queueTracklistSong = (songId: number) => {
		const song = librarySongsById.get(songId);
		if (song) player.addToQueue(song);
	};

	const contentMode = query.trim()
		? "search"
		: nowPlayingOpen
			? "nowplaying"
			: selectedAlbum
				? "album"
				: selectedArtist
					? "artist"
					: "library";

	return (
		<div className="app">
			<header className="app-header">
				<h1 className="app-title">Galleon</h1>
				<SearchBar value={query} onChange={handleQueryChange} />
				<ThemeToggle theme={theme} onToggle={toggleTheme} />
			</header>

			<div className="app-middle">
				<div className="big-player-col">
					<BigPlayer
						currentSong={player.currentSong}
						isPlaying={player.isPlaying}
						currentTime={player.currentTime}
						duration={player.duration}
						volume={player.volume}
						shuffle={player.shuffle}
						repeatMode={player.repeatMode}
						showQueue={showQueue}
						onTogglePlay={player.togglePlay}
						onNext={player.next}
						onPrev={player.prev}
						onSeek={player.seek}
						onVolumeChange={player.setVolume}
						onToggleShuffle={player.toggleShuffle}
						onCycleRepeat={player.cycleRepeatMode}
						onToggleQueue={() => setShowQueue((v) => !v)}
						onOpenArtist={openArtist}
						onOpenNowPlaying={openNowPlaying}
						onEnableVisualizer={player.enableVisualizer}
						getFrequencyData={player.getFrequencyData}
						frequencyBinCount={player.frequencyBinCount}
					/>
				</div>

				<div className="app-scroll">
					<div className="app-body">
						<div className="app-main">
							{contentMode === "search" && (
								<SearchResults
									query={query}
									library={library}
									albums={albums}
									artists={artists}
									onClear={() => setQuery("")}
									onPlaySong={(list, i) => player.playFromList(list, i)}
									onAddToQueue={player.addToQueue}
									onOpenAlbum={openAlbum}
									onOpenArtist={openArtist}
								/>
							)}

							{contentMode === "album" && selectedAlbum && (
								<AlbumView
									album={selectedAlbum}
									tracks={tracklist?.tracks ?? []}
									loading={albumSongsLoading}
									currentSongId={player.currentSong?.id}
									onBack={backToLibrary}
									onPlayAll={playAlbumFromStart}
									onSelect={playTracklistSong}
									onAddToQueue={queueTracklistSong}
									onOpenArtist={openArtist}
								/>
							)}

							{contentMode === "artist" && selectedArtist && (
								<ArtistView
									artist={selectedArtist}
									albums={artistAlbums}
									onBack={backToLibrary}
									onOpenAlbum={openAlbum}
									onSearchArtist={handleQueryChange}
								/>
							)}

							{contentMode === "nowplaying" && (
								<NowPlayingView
									currentSong={player.currentSong}
									isPlaying={player.isPlaying}
									currentTime={player.currentTime}
									duration={player.duration}
									shuffle={player.shuffle}
									repeatMode={player.repeatMode}
									onBack={backToLibrary}
									onTogglePlay={player.togglePlay}
									onNext={player.next}
									onPrev={player.prev}
									onSeek={player.seek}
									onToggleShuffle={player.toggleShuffle}
									onCycleRepeat={player.cycleRepeatMode}
									onOpenArtist={openArtist}
								/>
							)}

							{contentMode === "library" && (
								<>
									<div className="library-toolbar">
										<div className="view-tabs">
											<button
												className={`view-tab ${libraryView === "songs" ? "active" : ""}`}
												onClick={() => setLibraryView("songs")}
											>
												Songs
											</button>
											<button
												className={`view-tab ${libraryView === "albums" ? "active" : ""}`}
												onClick={() => setLibraryView("albums")}
											>
												Albums
											</button>
											<button
												className={`view-tab ${libraryView === "artists" ? "active" : ""}`}
												onClick={() => setLibraryView("artists")}
											>
												Artists
											</button>
										</div>
										<div className="library-toolbar-right">
											<span className="library-count">
												{libraryView === "songs" && `${library.length} tracks`}
												{libraryView === "albums" && `${albums.length} albums`}
												{libraryView === "artists" && `${artists.length} artists`}
											</span>
											<button className="text-btn" onClick={rescan} disabled={scanning}>
												{scanning ? "Scanning…" : "Rescan library"}
											</button>
										</div>
									</div>

									{libraryView === "songs" && (
										<TrackList
											songs={library}
											currentSongId={player.currentSong?.id}
											onSelect={(i) => player.playFromList(library, i)}
											onAddToQueue={player.addToQueue}
											emptyMessage="No tracks found. Rescan your library."
										/>
									)}
									{libraryView === "albums" && (
										<AlbumGrid albums={albums} onOpen={openAlbum} emptyMessage="No albums found. Rescan your library." />
									)}
									{libraryView === "artists" && (
										<ArtistGrid artists={artists} onOpen={openArtist} emptyMessage="No artists found. Rescan your library." />
									)}
								</>
							)}
						</div>

						{showQueue && (
							<div className="side-panels">
								<Queue
									queue={player.queue}
									upNext={player.upNext}
									shuffle={player.shuffle}
									onPlay={player.playFromQueue}
									onRemove={player.removeFromQueue}
									onReorder={player.reorderQueue}
									onAdd={player.addToQueue}
									onClear={player.clearQueue}
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			<MiniPlayer
				currentSong={player.currentSong}
				isPlaying={player.isPlaying}
				currentTime={player.currentTime}
				duration={player.duration}
				volume={player.volume}
				shuffle={player.shuffle}
				repeatMode={player.repeatMode}
				showQueue={showQueue}
				onTogglePlay={player.togglePlay}
				onNext={player.next}
				onPrev={player.prev}
				onSeek={player.seek}
				onVolumeChange={player.setVolume}
				onToggleShuffle={player.toggleShuffle}
				onCycleRepeat={player.cycleRepeatMode}
				onToggleQueue={() => setShowQueue((v) => !v)}
				onOpenNowPlaying={openNowPlaying}
				onEnableVisualizer={player.enableVisualizer}
				getFrequencyData={player.getFrequencyData}
				frequencyBinCount={player.frequencyBinCount}
			/>
		</div>
	);
}

export default App;
