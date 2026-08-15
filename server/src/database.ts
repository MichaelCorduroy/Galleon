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

export default db;
