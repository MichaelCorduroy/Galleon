import db from "./database";

export interface LikedSong {
	id: number;
	title: string;
	artist: string;
	album: string;
	duration: number;
	cover: string | null;
	likedAt: number;
}

const songExists = db.prepare(`SELECT id FROM songs WHERE id = ?`);
const likeStmt = db.prepare(`INSERT INTO liked_songs (song_id, liked_at) VALUES (?, ?) ON CONFLICT(song_id) DO NOTHING`);
const unlikeStmt = db.prepare(`DELETE FROM liked_songs WHERE song_id = ?`);

export function likeSong(songId: number): boolean {
	if (!songExists.get(songId)) return false;
	likeStmt.run(songId, Date.now());
	return true;
}

export function unlikeSong(songId: number): void {
	unlikeStmt.run(songId);
}

const listStmt = db.prepare(`
	SELECT s.id, s.title, s.artist, s.album, s.duration, s.cover, l.liked_at as likedAt
	FROM liked_songs l
	JOIN songs s ON s.id = l.song_id
	ORDER BY l.liked_at DESC
`);

export function listLikedSongs(): LikedSong[] {
	return listStmt.all() as LikedSong[];
}
