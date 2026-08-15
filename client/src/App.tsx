import { useEffect, useMemo, useState } from "react";
import {
	downloadKey,
	downloadTrack as apiDownloadTrack,
	fetchAlbums,
	fetchDiscover,
	fetchExplore,
	fetchLikedSongs,
	fetchSongs,
	fetchTracklist,
	likeSong as apiLikeSong,
	scanLibrary,
	unlikeSong as apiUnlikeSong,
	withRetry,
	type Album,
	type ExploreData,
	type LikedSong,
	type Song,
	type Tracklist,
} from "./api";
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
import { ExploreView } from "./components/ExploreView";
import { HistoryView } from "./components/HistoryView";
import { NowPlayingView } from "./components/NowPlayingView";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { ThemeToggle } from "./components/ThemeToggle";
import { DownloadsIndicator } from "./components/DownloadsIndicator";
import { ChevronLeftIcon, HistoryIcon } from "./icons";
import { Queue } from "./components/Queue";
import "./player.css";

type LibraryView = "songs" | "albums" | "artists" | "liked";
type BaseView = "explore" | "library";

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
	const [historyOpen, setHistoryOpen] = useState(false);
	const [baseView, setBaseView] = useState<BaseView>("explore");

	const [explore, setExplore] = useState<ExploreData | null>(null);
	const [exploreLoading, setExploreLoading] = useState(true);
	const [discover, setDiscover] = useState<Song[]>([]);
	const [discoverLoading, setDiscoverLoading] = useState(true);
	const [likedSongs, setLikedSongs] = useState<LikedSong[]>([]);
	const likedIds = useMemo(() => new Set(likedSongs.map((s) => s.id)), [likedSongs]);

	useEffect(() => {
		withRetry(fetchSongs).then(setLibrary).catch(() => {});
		withRetry(fetchAlbums).then(setAlbums).catch(() => {});
		fetchExplore()
			.then(setExplore)
			.finally(() => setExploreLoading(false));
		fetchDiscover()
			.then(setDiscover)
			.finally(() => setDiscoverLoading(false));
		fetchLikedSongs().then(setLikedSongs);
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
			setHistoryOpen(false);
		}
	};

	const openAlbum = (album: Album) => {
		setQuery("");
		setSelectedArtist(null);
		setNowPlayingOpen(false);
		setHistoryOpen(false);
		setSelectedAlbum(album);
		setAlbumSongsLoading(true);
		setTracklist(null);
		fetchTracklist(album.album, album.artist)
			.then(setTracklist)
			.catch(() => setTracklist(null))
			.finally(() => setAlbumSongsLoading(false));
	};

	// songs don't carry a track count, but openAlbum only reads .album/.artist
	// to fetch the real tracklist — the placeholder tracks:0 is never rendered
	const openAlbumFromSong = (song: Song) => {
		openAlbum({ album: song.album, artist: song.artist, cover: song.cover, tracks: 0 });
	};

	const openCurrentSongAlbum = () => {
		if (player.currentSong) openAlbumFromSong(player.currentSong);
	};

	const openArtist = (artist: string) => {
		setQuery("");
		setSelectedAlbum(null);
		setNowPlayingOpen(false);
		setHistoryOpen(false);
		setSelectedArtist(artist);
	};

	const openNowPlaying = () => {
		setQuery("");
		setSelectedAlbum(null);
		setSelectedArtist(null);
		setHistoryOpen(false);
		setNowPlayingOpen(true);
	};

	const openHistory = () => {
		setQuery("");
		setSelectedAlbum(null);
		setSelectedArtist(null);
		setNowPlayingOpen(false);
		setHistoryOpen(true);
	};

	// closes whatever overlay is open (album/artist/now-playing/history),
	// revealing whichever base view (explore or library tabs) was underneath
	const closeOverlay = () => {
		setSelectedAlbum(null);
		setSelectedArtist(null);
		setNowPlayingOpen(false);
		setHistoryOpen(false);
	};

	const openExplore = () => {
		setQuery("");
		closeOverlay();
		setBaseView("explore");
	};

	const openLibrary = () => {
		setQuery("");
		closeOverlay();
		setBaseView("library");
	};

	const openLikedSongs = () => {
		setQuery("");
		closeOverlay();
		setBaseView("library");
		setLibraryView("liked");
	};

	const shuffleLibrary = () => {
		if (library.length === 0) return;
		if (!player.shuffle) player.toggleShuffle();
		player.playFromList(library, Math.floor(Math.random() * library.length));
	};

	const artistAlbums = useMemo(
		() => (selectedArtist ? albums.filter((a) => a.artist === selectedArtist) : []),
		[albums, selectedArtist],
	);

	const librarySongsById = useMemo(() => new Map(library.map((s) => [s.id, s])), [library]);

	const toggleLike = (songId: number) => {
		if (likedIds.has(songId)) {
			setLikedSongs((prev) => prev.filter((s) => s.id !== songId));
			apiUnlikeSong(songId);
			return;
		}
		const song = librarySongsById.get(songId);
		if (!song) return;
		setLikedSongs((prev) => [{ ...song, likedAt: Date.now() }, ...prev]);
		apiLikeSong(songId);
	};

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

	// download is fired from three places (album view, its "download all
	// missing" button, and search results) — keep the in-flight/refresh
	// logic in one spot rather than duplicating it per call site
	const [downloadingKeys, setDownloadingKeys] = useState<Set<string>>(new Set());

	const handleDownload = async (artist: string, album: string, title: string) => {
		const key = downloadKey(artist, album, title);
		if (downloadingKeys.has(key)) return;
		setDownloadingKeys((prev) => new Set(prev).add(key));

		try {
			const result = await apiDownloadTrack(artist, album, title);
			if (result.success) {
				setLibrary(await fetchSongs());
				setAlbums(await fetchAlbums());
				if (selectedAlbum && selectedAlbum.artist === artist && selectedAlbum.album === album) {
					setTracklist(await fetchTracklist(album, artist));
				}
			} else {
				console.error("Download failed:", result.error);
			}
		} catch (err) {
			console.error("Download failed:", err);
		} finally {
			setDownloadingKeys((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		}
	};

	const contentMode = query.trim()
		? "search"
		: nowPlayingOpen
			? "nowplaying"
			: historyOpen
				? "history"
				: selectedAlbum
					? "album"
					: selectedArtist
						? "artist"
						: baseView;

	return (
		<div className="app">
			<header className="app-header">
				<button className="app-title" onClick={openExplore}>
					Galleon
				</button>
				<SearchBar value={query} onChange={handleQueryChange} />
				<DownloadsIndicator />
				<button
					className="icon-btn header-icon-btn"
					onClick={openHistory}
					aria-label="Listening history"
					title="Listening history"
				>
					<HistoryIcon size={15} />
				</button>
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
						liked={player.currentSong ? likedIds.has(player.currentSong.id) : false}
						onToggleLike={() => player.currentSong && toggleLike(player.currentSong.id)}
						onTogglePlay={player.togglePlay}
						onNext={player.next}
						onPrev={player.prev}
						onSeek={player.seek}
						onVolumeChange={player.setVolume}
						onToggleShuffle={player.toggleShuffle}
						onCycleRepeat={player.cycleRepeatMode}
						onToggleQueue={() => setShowQueue((v) => !v)}
						onOpenAlbum={openCurrentSongAlbum}
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
									downloadingKeys={downloadingKeys}
									onDownload={handleDownload}
									likedIds={likedIds}
									onToggleLike={toggleLike}
								/>
							)}

							{contentMode === "album" && selectedAlbum && (
								<AlbumView
									album={selectedAlbum}
									tracks={tracklist?.tracks ?? []}
									loading={albumSongsLoading}
									currentSongId={player.currentSong?.id}
									onBack={closeOverlay}
									onPlayAll={playAlbumFromStart}
									onSelect={playTracklistSong}
									onAddToQueue={queueTracklistSong}
									onOpenArtist={openArtist}
									downloadingKeys={downloadingKeys}
									onDownload={handleDownload}
									likedIds={likedIds}
									onToggleLike={toggleLike}
								/>
							)}

							{contentMode === "artist" && selectedArtist && (
								<ArtistView
									artist={selectedArtist}
									albums={artistAlbums}
									onBack={closeOverlay}
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
									liked={player.currentSong ? likedIds.has(player.currentSong.id) : false}
									onToggleLike={() => player.currentSong && toggleLike(player.currentSong.id)}
									onOpenAlbum={openCurrentSongAlbum}
									onBack={closeOverlay}
									onTogglePlay={player.togglePlay}
									onNext={player.next}
									onPrev={player.prev}
									onSeek={player.seek}
									onToggleShuffle={player.toggleShuffle}
									onCycleRepeat={player.cycleRepeatMode}
									onOpenArtist={openArtist}
								/>
							)}

							{contentMode === "history" && <HistoryView onBack={closeOverlay} onOpenArtist={openArtist} />}

							{contentMode === "explore" && (
								<ExploreView
									explore={explore}
									loading={exploreLoading}
									discover={discover}
									discoverLoading={discoverLoading}
									albums={albums}
									likedPreview={likedSongs.slice(0, 10)}
									likedIds={likedIds}
									onToggleLike={toggleLike}
									onShuffleLibrary={shuffleLibrary}
									onPlaySong={(list, i) => player.playFromList(list, i)}
									onOpenAlbum={openAlbum}
									onOpenAlbumFromSong={openAlbumFromSong}
									onOpenArtist={openArtist}
									onSeeLiked={openLikedSongs}
									onBrowseLibrary={openLibrary}
								/>
							)}

							{contentMode === "library" && (
								<>
									<button className="text-btn back-link" onClick={openExplore}>
										<ChevronLeftIcon size={13} />
										Explore
									</button>

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
											<button
												className={`view-tab ${libraryView === "liked" ? "active" : ""}`}
												onClick={() => setLibraryView("liked")}
											>
												Liked
											</button>
										</div>
										<div className="library-toolbar-right">
											<span className="library-count">
												{libraryView === "songs" && `${library.length} tracks`}
												{libraryView === "albums" && `${albums.length} albums`}
												{libraryView === "artists" && `${artists.length} artists`}
												{libraryView === "liked" && `${likedSongs.length} liked`}
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
											likedIds={likedIds}
											onToggleLike={toggleLike}
											onOpenAlbum={openAlbumFromSong}
											onOpenArtist={openArtist}
										/>
									)}
									{libraryView === "albums" && (
										<AlbumGrid albums={albums} onOpen={openAlbum} emptyMessage="No albums found. Rescan your library." />
									)}
									{libraryView === "artists" && (
										<ArtistGrid artists={artists} onOpen={openArtist} emptyMessage="No artists found. Rescan your library." />
									)}
									{libraryView === "liked" && (
										<TrackList
											songs={likedSongs}
											currentSongId={player.currentSong?.id}
											onSelect={(i) => player.playFromList(likedSongs, i)}
											onAddToQueue={player.addToQueue}
											emptyMessage="No liked songs yet — tap the heart on any track to save it here."
											likedIds={likedIds}
											onToggleLike={toggleLike}
											onOpenAlbum={openAlbumFromSong}
											onOpenArtist={openArtist}
										/>
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
				onOpenAlbum={openCurrentSongAlbum}
				onOpenNowPlaying={openNowPlaying}
				onEnableVisualizer={player.enableVisualizer}
				getFrequencyData={player.getFrequencyData}
				frequencyBinCount={player.frequencyBinCount}
			/>
		</div>
	);
}

export default App;
