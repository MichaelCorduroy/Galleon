import Database from "better-sqlite3";

const db = new Database("database.db");

db.exec(`CREATE TABLE IF NOT EXISTS songs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	artist TEXT,
	album TEXT,
	path TEXT UNIQUE NOT NULL,
	duration REAL,
	cover TEXT
)`);

const columns = db.prepare(`PRAGMA table_info(songs)`).all() as { name: string }[];
if (!columns.some((c) => c.name === "cover")) {
	db.exec(`ALTER TABLE songs ADD COLUMN cover TEXT`);
}

// canonical release metadata pulled from MusicBrainz — this is separate from
// the songs table (which only reflects what's actually on disk) so we can
// represent an album's full tracklist even when some tracks aren't owned
db.exec(`CREATE TABLE IF NOT EXISTS mb_albums (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	artist TEXT NOT NULL,
	mbid TEXT,
	cover TEXT,
	fetched_at INTEGER NOT NULL,
	UNIQUE(title, artist)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS mb_tracks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	album_id INTEGER NOT NULL REFERENCES mb_albums(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	title TEXT NOT NULL,
	duration REAL,
	mbid TEXT,
	song_id INTEGER REFERENCES songs(id) ON DELETE SET NULL,
	UNIQUE(album_id, position)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS similar_artists (
	artist TEXT NOT NULL,
	similar_artist TEXT NOT NULL,
	match REAL,
	fetched_at INTEGER NOT NULL,
	PRIMARY KEY (artist, similar_artist)
)`);

// one row per "real" listen (see the play-tracking threshold in
// useAudioPlayer.ts, mirroring Last.fm's scrobble rule) — title/artist/album
// are denormalized at insert time so history stays meaningful even if the
// underlying song is later rescanned away or retagged; song_id is kept
// nullable for the same reason
db.exec(`CREATE TABLE IF NOT EXISTS play_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	song_id INTEGER REFERENCES songs(id) ON DELETE SET NULL,
	title TEXT NOT NULL,
	artist TEXT NOT NULL,
	album TEXT NOT NULL,
	track_duration REAL,
	played_seconds REAL NOT NULL,
	played_at INTEGER NOT NULL
)`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at)`);

// explicit like — a much stronger signal than a passive listen, kept
// separate from play_history since it's not an event, it's a toggleable state
db.exec(`CREATE TABLE IF NOT EXISTS liked_songs (
	song_id INTEGER PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
	liked_at INTEGER NOT NULL
)`);

// Last.fm top tags per artist, treated as genres — feeds the 3D genre web.
// Cached the same way as similar_artists since tag data barely shifts
db.exec(`CREATE TABLE IF NOT EXISTS artist_genres (
	artist TEXT PRIMARY KEY,
	genres TEXT NOT NULL,
	fetched_at INTEGER NOT NULL
)`);

export default db;
