import Fastify from "fastify";
import {scanDirectory} from "./scanner";
import fs from "node:fs";
import path from "node:path";
import db from "./database";

const MIME_TYPES: Record<string, string> = {
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".ogg": "audio/ogg",
	".m4a": "audio/mp4",
	".flac": "audio/flac",
};

const IMAGE_MIME_TYPES: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
};

const COVERS_DIR = path.join(__dirname, "..", "covers");

const app = Fastify();
import cors from "@fastify/cors";


async function start() {
	

await app.register(cors, {
	origin: true 
});



app.get("/scan", async () => {
	//Replace path with where you store your music 
	const songs = await scanDirectory("../music");
	return songs;
});

app.get("/songs", async () => {
	const songs = db.prepare('SELECT id, title, artist, album, duration, cover FROM songs').all();
	return songs;
});

app.get("/covers/:filename", async (request, reply) => {
	const { filename } = request.params as { filename: string };
	const safeName = path.basename(filename);
	const filePath = path.join(COVERS_DIR, safeName);

	if (!fs.existsSync(filePath)) {
		return reply.code(404).send();
	}

	const mimeType = IMAGE_MIME_TYPES[path.extname(safeName).toLowerCase()] ?? "application/octet-stream";
	reply.type(mimeType);
	return reply.send(fs.createReadStream(filePath));
});


app.get("/stream/:id", async (request, reply) => {
	const { id } = request.params as { id: string };

	const song = db.prepare(`SELECT path FROM songs WHERE id = ?`).get(id) as
		{ path: string } | undefined;

	if (!song) {
		return reply.code(404).send("Song not found");
	}

	const mimeType = MIME_TYPES[path.extname(song.path).toLowerCase()] ?? "application/octet-stream";
	const stat = await fs.promises.stat(song.path);
	const range = request.headers.range;

	reply.header("Accept-Ranges", "bytes");
	reply.type(mimeType);

	if (range) {
		const match = /bytes=(\d*)-(\d*)/.exec(range);
		const start = match?.[1] ? parseInt(match[1], 10) : 0;
		const end = match?.[2] ? parseInt(match[2], 10) : stat.size - 1;

		if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
			reply.code(416);
			reply.header("Content-Range", `bytes */${stat.size}`);
			return reply.send();
		}

		reply.code(206);
		reply.header("Content-Range", `bytes ${start}-${end}/${stat.size}`);
		reply.header("Content-Length", end - start + 1);
		return reply.send(fs.createReadStream(song.path, { start, end }));
	}

	reply.header("Content-Length", stat.size);
	return reply.send(fs.createReadStream(song.path));
});

app.get("/albums", async () => {
	const albums = db.prepare('SELECT album, artist, COUNT(*) as tracks, MAX(cover) as cover FROM songs GROUP BY album, artist').all();
	return albums;
});

app.get("/albums/:album", async (request) => {
	const { album } = request.params as { album: string };
	const { artist } = request.query as { artist?: string };
	const songs = artist
		? db.prepare('SELECT id, title, artist, album, duration, cover FROM songs WHERE album = ? AND artist = ? ORDER BY id').all(album, artist)
		: db.prepare('SELECT id, title, artist, album, duration, cover FROM songs WHERE album = ? ORDER BY id').all(album);
	return songs;
});

app.get("/health", async () => {
	return  {
		status: "ok",
		service: "Galleon",
	};
});


app.listen({
	port: 3000,
	host: "0.0.0.0",
}).then((address) => {
	console.log(`Server listening at ${address}`);
});

}

start();

// to run server 
// npx tsx src/index.ts
