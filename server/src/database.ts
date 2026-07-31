import Database from "better-sqlite3";

const db = new Database("database.db");

db.exec(`CREATE TABLE IF NOT EXISTS songs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	artist TEXT,
	album TEXT,
	path TEXT UNIQUE NOT NULL,
	duration REAL
)`);

export default db;
