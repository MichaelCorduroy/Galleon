import fs from "node:fs/promises";
import path from "node:path";
import db from "./database";
import {parseFile} from "music-metadata";



// For most purposes these should be enough
// Remember to add more extensions if you need them
const AUDIO_EXTENSIONS = [
	'.mp3',
	'.wav',
	'.ogg',
	'.m4a',
	'.flac'
];


const insert = db.prepare(`
		INSERT OR IGNORE INTO songs
		(title, artist, album, path, duration)
		VALUES ( ?, ?, ?, ?, ?)
	`);



export async function scanDirectory(directory: string){

	const songs = [];

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
					const song = ({
						title: metadata.common.title ?? file.name,
						artist: metadata.common.artist ?? "Unknown Artist",
						album: metadata.common.album ?? "Unknown Album",
						path: fullPath,
						duration: metadata.format.duration,
					});

					songs.push(song);

					//add to database for saving 

					insert.run(
						song.title,
						song.artist,
						song.album,
						song.path,
						song.duration
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
