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

export default db;
