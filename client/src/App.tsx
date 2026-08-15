import { useEffect, useMemo, useState } from "react";
import { fetchAlbums, fetchAlbumSongs, fetchSongs, scanLibrary, withRetry, type Album, type Song } from "./api";
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
	const [albumSongs, setAlbumSongs] = useState<Song[]>([]);
	const [albumSongsLoading, setAlbumSongsLoading] = useState(false);
	const [selectedArtist, setSelectedArtist] = useState<string | null>(null);

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

	// the main content area is a single slot: search, album, artist and the
	// plain library tabs are mutually exclusive — starting a search drops
	// whatever album/artist was open, and opening an album/artist clears
	// the search box, so there's never ambiguity about what's showing
	const handleQueryChange = (next: string) => {
		setQuery(next);
		if (next.trim()) {
			setSelectedAlbum(null);
			setSelectedArtist(null);
		}
	};

	const openAlbum = (album: Album) => {
		setQuery("");
		setSelectedArtist(null);
		setSelectedAlbum(album);
		setAlbumSongsLoading(true);
		fetchAlbumSongs(album.album, album.artist)
			.then(setAlbumSongs)
			.finally(() => setAlbumSongsLoading(false));
	};

	const openArtist = (artist: string) => {
		setQuery("");
		setSelectedAlbum(null);
		setSelectedArtist(artist);
	};

	const backToLibrary = () => {
		setSelectedAlbum(null);
		setSelectedArtist(null);
	};

	const artistAlbums = useMemo(
		() => (selectedArtist ? albums.filter((a) => a.artist === selectedArtist) : []),
		[albums, selectedArtist],
	);

	const contentMode = query.trim() ? "search" : selectedAlbum ? "album" : selectedArtist ? "artist" : "library";

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
									songs={albumSongs}
									loading={albumSongsLoading}
									currentSongId={player.currentSong?.id}
									onBack={backToLibrary}
									onPlayAll={() => player.playFromList(albumSongs, 0)}
									onSelect={(i) => player.playFromList(albumSongs, i)}
									onAddToQueue={player.addToQueue}
									onOpenArtist={openArtist}
								/>
							)}

							{contentMode === "artist" && selectedArtist && (
								<ArtistView artist={selectedArtist} albums={artistAlbums} onBack={backToLibrary} onOpenAlbum={openAlbum} />
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
				onEnableVisualizer={player.enableVisualizer}
				getFrequencyData={player.getFrequencyData}
				frequencyBinCount={player.frequencyBinCount}
			/>
		</div>
	);
}

export default App;
