import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import db from "./database";
import { parseFile } from "music-metadata";

// For most purposes these should be enough
// Remember to add more extensions if you need them
const AUDIO_EXTENSIONS = [
	'.mp3',
	'.wav',
	'.ogg',
	'.m4a',
	'.flac'
];

const COVERS_DIR = path.join(__dirname, "..", "covers");
fsSync.mkdirSync(COVERS_DIR, { recursive: true });

const COVER_EXT_BY_MIME: Record<string, string> = {
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/webp": ".webp",
};

function saveCover(artist: string, album: string, picture?: { format: string; data: Uint8Array }): string | null {
	if (!picture) return null;
	const ext = COVER_EXT_BY_MIME[picture.format] ?? ".jpg";
	const filename = `${crypto.createHash("md5").update(`${artist}::${album}`).digest("hex")}${ext}`;
	const fullPath = path.join(COVERS_DIR, filename);

	if (!fsSync.existsSync(fullPath)) {
		fsSync.writeFileSync(fullPath, picture.data);
	}

	return filename;
}

interface ScannedSong {
	title: string;
	artist: string;
	album: string;
	path: string;
	duration: number | undefined;
	cover: string | null;
}

const insert = db.prepare(`
	INSERT INTO songs (title, artist, album, path, duration, cover)
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT(path) DO UPDATE SET
		title = excluded.title,
		artist = excluded.artist,
		album = excluded.album,
		duration = excluded.duration,
		cover = excluded.cover
`);



export async function scanDirectory(directory: string){

	const songs: ScannedSong[] = [];

	async function walk(folder: string){

		const files = await fs.readdir(folder,
					       {withFileTypes: true
				});

		for (const file of files){
			const fullPath = path.join(folder, file.name);

			if (file.isDirectory()){
				await walk(fullPath);
			}
			else if (AUDIO_EXTENSIONS.includes(path.extname(file.name))){

				try {
					const metadata = await parseFile(fullPath);
					const artist = metadata.common.artist ?? "Unknown Artist";
					const album = metadata.common.album ?? "Unknown Album";
					const song: ScannedSong = ({
						title: metadata.common.title ?? file.name,
						artist,
						album,
						path: fullPath,
						duration: metadata.format.duration,
						cover: saveCover(artist, album, metadata.common.picture?.[0]),
					});

					songs.push(song);

					//add to database for saving

					insert.run(
						song.title,
						song.artist,
						song.album,
						song.path,
						song.duration,
						song.cover
					);
				}catch (err) {
					console.error(
						'Error parsing file: ', fullPath, err);

				}
			}
		}
	}


	await walk(directory);
	return songs;


}
